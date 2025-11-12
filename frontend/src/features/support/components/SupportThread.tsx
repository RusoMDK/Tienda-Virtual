// src/features/support/components/SupportThread.tsx
import { useEffect, useRef, useState } from "react";
import {
  useAssign,
  useChangeStatus,
  useConversation,
  useMeLite,
  useSendMessage,
} from "../hooks";
import { Button, Textarea, Skeleton, useToast } from "@/ui";
import { ConvStatus, MsgKind } from "../types";
import {
  AtSign,
  Lock,
  SendHorizonal,
  User,
  UserRound,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";

export default function SupportThread({ id }: { id?: string }) {
  const toast = useToast();
  const { data: me } = useMeLite();
  const { data, isLoading, isError } = useConversation(id);
  const assignMut = useAssign(id);
  const statusMut = useChangeStatus(id);
  const sendMut = useSendMessage(id);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll al final en cambios
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      listRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [data?.messages?.length, id]);

  const [text, setText] = useState("");
  const [kind, setKind] = useState<MsgKind>(MsgKind.AGENT);
  const canSend = text.trim().length > 0 && !sendMut.isPending;

  async function onSend() {
    try {
      await sendMut.mutateAsync({ text: text.trim(), kind });
      setText("");
    } catch (e: any) {
      toast({ title: e?.message || "No se pudo enviar", variant: "error" });
    }
  }

  async function assignMe() {
    try {
      if (!me?.id) return;
      await assignMut.mutateAsync(me.id);
    } catch {
      toast({ title: "No se pudo asignar", variant: "error" });
    }
  }

  async function unassign() {
    try {
      await assignMut.mutateAsync(null);
    } catch {
      toast({ title: "No se pudo quitar asignación", variant: "error" });
    }
  }

  async function setStatus(s: ConvStatus) {
    try {
      await statusMut.mutateAsync(s);
    } catch {
      toast({ title: "No se pudo cambiar estado", variant: "error" });
    }
  }

  if (!id) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-sm opacity-70">Selecciona una conversación.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-[60%]" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-sm text-[rgb(var(--danger-rgb))]">
          No se pudo cargar.
        </div>
      </div>
    );
  }

  const youAreAssignee =
    data.assignedToId && me?.id && data.assignedToId === me.id;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-[rgb(var(--border-rgb))] flex flex-wrap items-center gap-2">
        <div className="font-semibold truncate min-w-0">
          {data.subject || "(sin asunto)"}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusPill status={data.status} />
          <div className="inline-flex rounded-xl overflow-hidden border border-[rgb(var(--border-rgb))]">
            <HeaderBtn
              onClick={() => setStatus(ConvStatus.OPEN)}
              active={data.status === ConvStatus.OPEN}
            >
              Abierto
            </HeaderBtn>
            <HeaderBtn
              onClick={() => setStatus(ConvStatus.PENDING)}
              active={data.status === ConvStatus.PENDING}
            >
              Pendiente
            </HeaderBtn>
            <HeaderBtn
              onClick={() => setStatus(ConvStatus.RESOLVED)}
              active={data.status === ConvStatus.RESOLVED}
            >
              Resuelto
            </HeaderBtn>
            <HeaderBtn
              onClick={() => setStatus(ConvStatus.CLOSED)}
              active={data.status === ConvStatus.CLOSED}
            >
              Cerrado
            </HeaderBtn>
          </div>
          {!data.assignedTo && (
            <Button size="sm" onClick={assignMe} title="Asignarme">
              <UserRound size={14} className="mr-1" /> Asignarme
            </Button>
          )}
          {!!data.assignedTo && (
            <Button
              size="sm"
              variant="secondary"
              onClick={unassign}
              title="Quitar asignación"
            >
              <User size={14} className="mr-1" />{" "}
              {youAreAssignee ? "Quitarme" : "Quitar"}
            </Button>
          )}
        </div>
      </div>

      {/* Mensajes */}
      <div ref={listRef} className="flex-1 overflow-auto p-3 space-y-3">
        {data.messages.map((m) => (
          <MessageBubble
            key={m.id}
            mine={m.authorId === me?.id || m.kind === MsgKind.AGENT}
            kind={m.kind}
            author={m.author}
            text={m.text}
            createdAt={m.createdAt}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-[rgb(var(--border-rgb))] p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select
            className="rounded-xl px-2 py-1.5 text-sm bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]"
            value={kind}
            onChange={(e) => setKind(e.target.value as MsgKind)}
            title="Tipo de mensaje"
          >
            <option value={MsgKind.AGENT}>Respuesta al cliente</option>
            <option value={MsgKind.INTERNAL}>Nota interna</option>
            <option value={MsgKind.USER} disabled>
              Mensaje de cliente
            </option>
          </select>
          {kind === MsgKind.INTERNAL ? (
            <span className="text-xs inline-flex items-center gap-1 opacity-80">
              <Lock size={14} /> Visible solo para el equipo
            </span>
          ) : (
            <span className="text-xs inline-flex items-center gap-1 opacity-80">
              <AtSign size={14} /> Visible para el cliente
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={
              kind === MsgKind.INTERNAL
                ? "Escribe una nota interna…"
                : "Escribe tu respuesta…"
            }
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSend();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={onSend}
            disabled={!canSend}
            title="Enviar"
            className="md:self-end"
          >
            <SendHorizonal size={16} />
          </Button>
        </div>
        <div className="text-[11px] opacity-60 mt-1">
          Ctrl/⌘ + Enter para enviar
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  mine,
  kind,
  author,
  text,
  createdAt,
}: {
  mine?: boolean;
  kind: MsgKind;
  author?: { name: string | null; email: string; role?: string };
  text: string;
  createdAt: string;
}) {
  const time = new Date(createdAt).toLocaleString();
  const tone =
    kind === MsgKind.INTERNAL
      ? "bg-amber-500/10 border-amber-400/30"
      : mine
      ? "bg-[rgb(var(--muted-rgb))] border-[rgb(var(--border-rgb))]"
      : "bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]";

  return (
    <div
      className={cn(
        "max-w-[90%] sm:max-w-[85%] rounded-xl border p-2",
        mine ? "ml-auto" : "",
        tone
      )}
    >
      <div className="text-[11px] opacity-70 mb-1 flex items-center justify-between gap-2">
        <span className="truncate">
          {author?.name || author?.email || "Usuario"}{" "}
          {kind === MsgKind.INTERNAL && "• Nota interna"}
        </span>
        <span className="shrink-0">{time}</span>
      </div>
      <div className="text-sm whitespace-pre-wrap">{text}</div>
    </div>
  );
}

function HeaderBtn({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 text-xs",
        active
          ? "bg-[rgb(var(--card-rgb))]"
          : "bg-[rgb(var(--card-2-rgb))] hover:bg-[rgb(var(--card-rgb))]"
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status?: ConvStatus | null }) {
  const map: Record<string, { label: string; icon: any; klass: string }> = {
    OPEN: { label: "Abierto", icon: AlertCircle, klass: "text-emerald-600" },
    PENDING: { label: "Pendiente", icon: AlertCircle, klass: "text-amber-600" },
    RESOLVED: { label: "Resuelto", icon: CheckCircle2, klass: "text-sky-600" },
    CLOSED: { label: "Cerrado", icon: CheckCircle2, klass: "text-zinc-600" },
  };

  const fallback = {
    label: "Estado desconocido",
    icon: AlertCircle,
    klass: "text-zinc-600",
  };

  const meta = status ? map[status as string] ?? fallback : fallback;
  const Icon = meta.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", meta.klass)}>
      <Icon size={16} /> {meta.label}
    </span>
  );
}
