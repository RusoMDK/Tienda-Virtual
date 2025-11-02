import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConversation,
  sendMessage as apiSendMessage,
  assignConversation,
  setConversationStatus,
  listAgents,
  getMe,
  markSeen,
} from "@/features/support/api";
import type {
  Conversation,
  Message,
  NewAttachment,
} from "@/features/support/types";
import { ConvStatus, MsgKind, ConvPriority } from "@/features/support/types";
import { Button, Input, Skeleton, useToast } from "@/ui";
import {
  ArrowLeft,
  Mail,
  Shield,
  User as UserIcon,
  Paperclip,
  Upload,
  Tag as TagIcon,
  Flag,
  Hash,
  Clock,
} from "lucide-react";
import { useSupportConversationStream } from "@/features/support/hooks/stream";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { api } from "@/lib/api";

// ─────────────────────────────────────────────────────────
// Helpers API locales (priority + tags) — si prefieres, muévelos a api.ts
// ─────────────────────────────────────────────────────────
async function setConversationPriority(id: string, priority: ConvPriority) {
  const { data } = await api.post(`/support/conversations/${id}/priority`, {
    priority,
  });
  return data as Conversation;
}
async function updateConversationTags(
  id: string,
  payload: { add?: string[]; remove?: string[] }
) {
  const { data } = await api.post<{
    ok: boolean;
    tags: { id: string; tag: string }[];
  }>(`/support/conversations/${id}/tags`, payload);
  return data;
}

// SLA thresholds (alineados con backend por defecto)
const SLA_AT_RISK_MIN = 15;

// Formateos
function formatBytes(b?: number) {
  if (!b && b !== 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
function timeDiffLabel(target?: string | null) {
  if (!target) return "—";
  const t = new Date(target).getTime();
  const now = Date.now();
  const diff = t - now; // ms restantes
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  const short = hours > 0 ? `${hours}h ${remMin}m` : `${mins}m`;
  return diff < 0 ? `vencido hace ${short}` : `en ${short}`;
}
function slaClass(target?: string | null) {
  if (!target)
    return "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30";
  const t = new Date(target).getTime();
  const now = Date.now();
  if (now > t)
    return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"; // breach
  if (t - now <= SLA_AT_RISK_MIN * 60000)
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"; // at-risk
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"; // ok
}

function StatusPill({ status }: { status: ConvStatus }) {
  const map: Record<ConvStatus, string> = {
    OPEN: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    PENDING: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    RESOLVED: "bg-sky-500/15 text-sky-500 border-sky-500/30",
    CLOSED: "bg-zinc-500/15 text-zinc-400 border-zinc-600/40",
  };
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        map[status],
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function PriorityPill({ p }: { p?: ConvPriority }) {
  const map: Partial<Record<ConvPriority, string>> = {
    LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    NORMAL:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    HIGH: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    URGENT: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  };
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        map[p ?? "NORMAL"],
      ].join(" ")}
    >
      <Flag size={12} className="opacity-80" />
      {p ?? "NORMAL"}
    </span>
  );
}

export default function SupportConversationPage() {
  const { id = "" } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [asInternal, setAsInternal] = useState(false);
  const [pendingAtts, setPendingAtts] = useState<NewAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newTag, setNewTag] = useState("");

  // 🔴 Stream en vivo de esta conversación
  useSupportConversationStream(id);

  // Usuario actual (para permisos y "Asignarme")
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    staleTime: 60_000,
  });
  const isStaff = meQ.data?.role === "ADMIN" || meQ.data?.role === "SUPPORT";

  // Conversación
  const convQ = useQuery({
    queryKey: ["support:conversation", id],
    queryFn: () => getConversation(id),
    enabled: !!id,
    staleTime: 10_000,
  });
  const conv:
    | (Conversation & {
        messages: Message[];
        tags?: { id: string; tag: string }[];
      })
    | undefined = convQ.data as any;

  // Lista de agentes para asignar
  const agentsQ = useQuery({
    queryKey: ["support:agents"],
    queryFn: () => listAgents({ ps: 100 }),
    staleTime: 60_000,
    enabled: !!isStaff,
  });

  // Visto
  useEffect(() => {
    if (!conv || !meQ.data) return;
    const isOwner = conv.userId && conv.userId === meQ.data.id;
    if (!(isOwner || isStaff)) return;
    markSeen(id).finally(() => {
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
    });
  }, [id, conv?.messages?.length, isStaff, meQ.data, qc]);

  // Autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight + 1000;
  }, [conv?.messages?.length]);

  // Mutations
  const sendMut = useMutation({
    mutationFn: (payload: {
      text?: string;
      kind?: MsgKind;
      attachments?: NewAttachment[];
    }) => apiSendMessage(id, payload),
    onSuccess: () => {
      setText("");
      setPendingAtts([]);
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
    },
    onError: () =>
      toast({ title: "No se pudo enviar el mensaje", variant: "error" }),
  });

  const assignMut = useMutation({
    mutationFn: (agentId: string | null) => assignConversation(id, agentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
    },
    onError: () =>
      toast({ title: "No se pudo cambiar la asignación", variant: "error" }),
  });

  const statusMut = useMutation({
    mutationFn: (status: ConvStatus) => setConversationStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
    },
    onError: () =>
      toast({ title: "No se pudo cambiar el estado", variant: "error" }),
  });

  const priorityMut = useMutation({
    mutationFn: (p: ConvPriority) => setConversationPriority(id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
    },
    onError: () =>
      toast({ title: "No se pudo cambiar la prioridad", variant: "error" }),
  });

  const tagsMut = useMutation({
    mutationFn: (payload: { add?: string[]; remove?: string[] }) =>
      updateConversationTags(id, payload),
    onSuccess: () => {
      setNewTag("");
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
    },
    onError: () =>
      toast({ title: "No se pudieron actualizar los tags", variant: "error" }),
  });

  const canSend = useMemo(() => {
    if (!conv || !meQ.data) return false;
    const ownerOk = conv.userId && conv.userId === meQ.data.id;
    return ownerOk || isStaff;
  }, [conv, meQ.data, isStaff]);

  async function handleUploadSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (f) => {
          const r = await uploadToCloudinary(f, "support");
          const mimeGuess =
            f.type ||
            (r.format ? `image/${r.format}` : "application/octet-stream");
          const att: NewAttachment = {
            url: r.url,
            publicId: r.publicId,
            bytes: r.bytes ?? f.size,
            mime: mimeGuess,
            width: r.width ?? null,
            height: r.height ?? null,
            filename: f.name ?? null,
          };
          return att;
        })
      );
      setPendingAtts((prev) => [...prev, ...uploaded]);
    } catch (e) {
      console.error(e);
      toast({ title: "Error subiendo archivo(s)", variant: "error" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && pendingAtts.length === 0) return;
    const kind: MsgKind = isStaff
      ? asInternal
        ? MsgKind.INTERNAL
        : MsgKind.AGENT
      : MsgKind.USER;
    sendMut.mutate({
      text: trimmed || undefined,
      kind,
      attachments: pendingAtts,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  // Loading / error
  if (convQ.isLoading) {
    return (
      <div className="container py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4">
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (convQ.isError || !conv) {
    return (
      <div className="container py-10">
        <div className="rounded-2xl border border-red-900/40 bg-red-900/10 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Conversación no encontrada
              </h2>
              <p className="text-sm opacity-80">
                Puede que haya sido eliminada o no tengas permisos.
              </p>
            </div>
            <Button onClick={() => nav("/admin/support")}>
              <ArrowLeft className="mr-1" size={16} />
              Volver al inbox
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const frtActive = !conv.firstResponseAt;
  const frtTarget = frtActive ? conv.firstResponseSlaAt : null;
  const resActive = !!conv.firstResponseAt && !conv.resolvedAt;
  const resTarget = resActive ? conv.resolutionSlaAt : null;

  const tagList = (conv.tags || []).map((t) => t.tag);

  return (
    <div className="container py-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="secondary" onClick={() => nav("/admin/support")}>
            <ArrowLeft className="mr-1" size={16} /> Inbox
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">
                {conv.subject || "Conversación"}
              </h1>
              <StatusPill status={conv.status} />
              <PriorityPill p={conv.priority as ConvPriority | undefined} />
            </div>
            <div className="text-xs opacity-70 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Hash size={12} /> {conv.id.slice(0, 8)}
              </span>
              <span>·</span>
              <span>
                {new Date(conv.createdAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Asignación */}
          <div className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-2 py-1">
            <UserIcon size={14} className="opacity-80" />
            <span className="text-sm">
              {conv.assignedTo
                ? `Asignado a ${conv.assignedTo.name || conv.assignedTo.email}`
                : "Sin asignar"}
            </span>
            {isStaff && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => assignMut.mutate(meQ.data?.id || null)}
                  disabled={assignMut.isPending}
                  title="Asignarme"
                >
                  Asignarme
                </Button>
                {conv.assignedToId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => assignMut.mutate(null)}
                    disabled={assignMut.isPending}
                    title="Quitar asignación"
                  >
                    Quitar
                  </Button>
                )}
                <select
                  className="rounded-lg border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-2 py-1 text-sm"
                  onChange={(e) => {
                    const val = e.target.value;
                    assignMut.mutate(val ? val : null);
                    e.currentTarget.selectedIndex = 0; // vuelve al placeholder
                  }}
                >
                  <option value="">Asignar a…</option>
                  {agentsQ.data?.items?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.email}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Estado */}
          {isStaff && (
            <select
              className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-2 text-sm"
              value={conv.status}
              onChange={(e) => statusMut.mutate(e.target.value as ConvStatus)}
              disabled={statusMut.isPending}
              title="Cambiar estado"
            >
              {Object.values(ConvStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Prioridad */}
          {isStaff && (
            <select
              className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-2 text-sm"
              value={(conv.priority as ConvPriority) || "NORMAL"}
              onChange={(e) =>
                priorityMut.mutate(e.target.value as ConvPriority)
              }
              disabled={priorityMut.isPending}
              title="Cambiar prioridad"
            >
              {(["LOW", "NORMAL", "HIGH", "URGENT"] as ConvPriority[]).map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          )}
        </div>
      </div>

      {/* SLA quick view */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-2 py-1",
            slaClass(frtTarget),
          ].join(" ")}
          title={frtTarget || undefined}
        >
          <Clock size={12} />
          1ª respuesta: <strong>{timeDiffLabel(frtTarget)}</strong>
        </span>
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full border px-2 py-1",
            slaClass(resTarget),
          ].join(" ")}
          title={resTarget || undefined}
        >
          <Clock size={12} />
          Resolución: <strong>{timeDiffLabel(resTarget)}</strong>
        </span>
      </div>

      {/* Tags */}
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3">
        <div className="flex items-center gap-2">
          <TagIcon size={14} className="opacity-80" />
          <div className="flex flex-wrap gap-2">
            {tagList.length ? (
              tagList.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {t}
                  {isStaff && (
                    <button
                      className="ml-1 rounded px-1 text-[10px] bg-zinc-200/30 hover:bg-zinc-200/50"
                      onClick={() => tagsMut.mutate({ remove: [t] })}
                      title="Quitar tag"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))
            ) : (
              <span className="text-xs opacity-60">Sin tags</span>
            )}
          </div>
          {isStaff && (
            <div className="ml-auto flex items-center gap-2">
              <Input
                placeholder="Agregar tag y Enter…"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const tag = newTag.trim();
                    if (!tag) return;
                    if (tagList.includes(tag)) {
                      setNewTag("");
                      return;
                    }
                    tagsMut.mutate({ add: [tag] });
                  }
                }}
                className="h-8"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const tag = newTag.trim();
                  if (!tag) return;
                  if (tagList.includes(tag)) {
                    setNewTag("");
                    return;
                  }
                  tagsMut.mutate({ add: [tag] });
                }}
              >
                Añadir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] overflow-hidden">
        <div
          ref={listRef}
          className="max-h-[58vh] overflow-y-auto p-4 space-y-3"
        >
          {conv.messages.length === 0 && (
            <div className="text-sm opacity-70">Sin mensajes.</div>
          )}

          {conv.messages.map((m) => {
            const mine = m.authorId === meQ.data?.id;
            const isAgent =
              m.kind === MsgKind.AGENT || m.kind === MsgKind.INTERNAL;
            const isInternal = m.kind === MsgKind.INTERNAL;
            const isImage = (aMime?: string) =>
              (aMime || "").startsWith("image/");

            return (
              <div
                key={m.id}
                className={[
                  "flex w-full",
                  mine || isAgent ? "justify-end" : "justify-start",
                ].join(" ")}
              >
                <div
                  className={[
                    "max-w-[80%] rounded-2xl border px-3 py-2 text-sm shadow-sm",
                    isInternal
                      ? "bg-amber-900/10 border-amber-700/30"
                      : mine || isAgent
                      ? "bg-[rgb(var(--muted-rgb))] border-[rgb(var(--border-rgb))]"
                      : "bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]",
                  ].join(" ")}
                  title={new Date(m.createdAt).toLocaleString()}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {isAgent ? (
                      <Shield size={12} className="opacity-70" />
                    ) : (
                      <Mail size={12} className="opacity-70" />
                    )}
                    <span className="text-[11px] opacity-70">
                      {m.author?.name || m.author?.email || "Usuario"}
                      {isInternal ? " · Nota interna" : ""}
                    </span>
                  </div>

                  {m.text ? (
                    <div className="whitespace-pre-wrap leading-relaxed mb-2">
                      {m.text}
                    </div>
                  ) : null}

                  {/* Adjuntos */}
                  {m.attachments?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {m.attachments.map((a) =>
                        isImage(a.mime) ? (
                          <img
                            key={a.id}
                            src={a.url}
                            alt={a.filename || a.publicId}
                            className="max-h-48 rounded-lg"
                            loading="lazy"
                          />
                        ) : (
                          <a
                            key={a.id}
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs underline"
                            title={a.filename || a.publicId}
                          >
                            <Paperclip size={14} />
                            <span className="truncate max-w-[180px]">
                              {a.filename || a.publicId}
                            </span>
                            <span className="opacity-60">
                              {formatBytes(a.bytes)}
                            </span>
                          </a>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        {canSend ? (
          <div className="border-t border-[rgb(var(--border-rgb))] p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-2 flex-1">
                <textarea
                  className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] p-3 text-sm min-h-[64px] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  placeholder={
                    isStaff
                      ? "Escribe un mensaje… (Ctrl/Cmd + Enter para enviar)"
                      : "Escribe tu mensaje de soporte…"
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                {/* Previews de adjuntos pendientes */}
                {pendingAtts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingAtts.map((a, i) =>
                      (a.mime || "").startsWith("image/") ? (
                        <div key={`${a.publicId}-${i}`} className="relative">
                          <img
                            src={a.url}
                            alt={a.filename || a.publicId}
                            className="h-24 w-24 rounded-lg object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAtts((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white text-xs px-2 py-1"
                            title="Quitar"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div
                          key={`${a.publicId}-${i}`}
                          className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"
                          title={a.filename || a.publicId}
                        >
                          <Paperclip size={14} />
                          <span className="truncate max-w-[180px]">
                            {a.filename || a.publicId}
                          </span>
                          <span className="opacity-60">
                            {formatBytes(a.bytes)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAtts((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="ml-2 rounded bg-zinc-200/20 px-1.5"
                            title="Quitar"
                          >
                            Quitar
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs opacity-60">
                  <div className="flex items-center gap-2">
                    {isStaff && (
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-amber-500"
                          checked={asInternal}
                          onChange={(e) => setAsInternal(e.target.checked)}
                        />
                        Nota interna
                      </label>
                    )}

                    {/* Subir archivos */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => handleUploadSelected(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1"
                      title="Adjuntar archivos"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <Upload size={14} />
                          Subiendo…
                        </>
                      ) : (
                        <>
                          <Paperclip size={14} />
                          Adjuntar
                        </>
                      )}
                    </button>
                  </div>
                  <div className="ml-auto">Ctrl/⌘ + Enter para enviar</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Button
                  onClick={handleSend}
                  disabled={
                    sendMut.isPending ||
                    uploading ||
                    (!text.trim() && pendingAtts.length === 0)
                  }
                >
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-[rgb(var(--border-rgb))] p-3 text-sm opacity-70">
            No puedes enviar mensajes en esta conversación.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs opacity-70">
        <div>
          <Link className="underline" to="/admin/support">
            Volver al inbox
          </Link>
        </div>
        <div>
          Creado:{" "}
          {new Date(conv.createdAt).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
          {" · "}
          Última act.:{" "}
          {new Date(conv.updatedAt).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </div>
      </div>
    </div>
  );
}
