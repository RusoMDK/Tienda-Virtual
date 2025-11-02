// src/features/support/components/SupportWidget.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConversation,
  getMyLatestConversation,
  getConversation,
  sendMessage,
  markSeen,
} from "../api";
import { Button, Textarea, useToast } from "@/ui";
import {
  MessageSquare,
  X,
  SendHorizonal,
  Loader2,
  CircleDot,
  CircleDashed,
  LogIn,
} from "lucide-react";
import { useSupportConversationStream } from "../hooks/stream";
import { MsgKind, type Message } from "../types";
import { useAuthStore } from "@/store/auth";
import { Link } from "react-router-dom";

const BRAND = { name: "tienda", avatar: "/brand-assets/logo_thumbnail.svg" };

function useSimpleAvailability() {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const calc = () => {
      const d = new Date();
      const h = d.getHours();
      const wd = d.getDay();
      setOnline(wd >= 1 && wd <= 5 && h >= 9 && h < 18);
    };
    calc();
    const t = setInterval(calc, 60_000);
    return () => clearInterval(t);
  }, []);
  return online;
}

export default function SupportWidget() {
  const token = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const qc = useQueryClient();
  const toast = useToast();
  const online = useSimpleAvailability();

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const latestQ = useQuery({
    queryKey: ["support:my-latest"],
    queryFn: getMyLatestConversation,
    enabled: open && !!token,
  });

  useEffect(() => {
    if (!latestQ.data || !open) return;
    const { conversation, messages } = latestQ.data;
    if (conversation?.id) {
      setConvId(conversation.id);
      qc.setQueryData(["support:conversation", conversation.id], {
        ...conversation,
        messages,
      });
      void markSeen(conversation.id).catch(() => {});
      setUnread(0);
    } else {
      setConvId(null);
    }
  }, [latestQ.data, open, qc]);

  const convQ = useQuery({
    queryKey: ["support:conversation", convId],
    queryFn: () => (convId ? getConversation(convId) : Promise.resolve(null)),
    enabled: !!convId && !!token,
    staleTime: 10_000,
    refetchInterval: open ? 5000 : 15000,
  });

  useEffect(() => {
    if (!open || !convQ.data) return;
    const t = setTimeout(
      () => listRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }),
      30
    );
    return () => clearTimeout(t);
  }, [open, convQ.data?.messages?.length]);

  useSupportConversationStream(convId || "");

  useEffect(() => {
    if (!open || !convId || !convQ.data?.messages?.length) return;
    void markSeen(convId).catch(() => {});
  }, [open, convId, convQ.data?.messages?.length]);

  const lastMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!convQ.data?.messages?.length) return;
    const lastId = convQ.data.messages[convQ.data.messages.length - 1].id;
    if (!open && lastMsgIdRef.current && lastMsgIdRef.current !== lastId)
      setUnread((u) => Math.min(9, u + 1));
    lastMsgIdRef.current = lastId;
    if (open) setUnread(0);
  }, [open, convQ.data?.messages?.length]);

  const startMut = useMutation({
    mutationFn: async () => {
      const first = text.trim();
      if (!first) throw new Error("Escribe tu mensaje");
      const conv = await createConversation({ firstMessage: first });
      setText("");
      setConvId(conv.id);
      qc.setQueryData(["support:conversation", conv.id], {
        ...conv,
        messages: [] as Message[],
      });
      qc.invalidateQueries({ queryKey: ["support:my-latest"] });
      qc.invalidateQueries({ queryKey: ["support:conversation", conv.id] });
      return conv;
    },
    onError: (e: any) =>
      toast({
        title: e?.message || "No se pudo iniciar el chat",
        variant: "error",
      }),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      const msg = text.trim();
      if (!convId || !msg) return;
      await sendMessage(convId, { text: msg, kind: MsgKind.USER });
    },
    onSuccess: () => {
      setText("");
      if (convId)
        qc.invalidateQueries({ queryKey: ["support:conversation", convId] });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "No se pudo enviar", variant: "error" }),
  });

  const canSend =
    text.trim().length > 0 && !(sendMut.isPending || startMut.isPending);
  const isLoadingThread =
    !!token && (latestQ.isLoading || (convId && convQ.isLoading));

  function handleSend() {
    if (!text.trim()) return;
    if (!convId) startMut.mutate();
    else sendMut.mutate();
  }

  const subtitle = useMemo(
    () => (online ? "Estamos en línea" : "Estamos ausentes en este momento"),
    [online]
  );

  return (
    <>
      {/* Burbuja */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full h-14 w-14 grid place-items-center shadow-lg border border-[rgb(var(--border-rgb))] bg-gradient-to-br from-[var(--brand-start)] to-[var(--brand-end)] text-[rgb(var(--bg-rgb))] transition hover:scale-[1.03] active:scale-[0.98]"
        title="Chat de soporte"
        aria-label="Chat de soporte"
      >
        <div className="relative">
          <MessageSquare size={22} />
          {unread > 0 && (
            <span
              className="absolute -right-2 -top-2 h-5 min-w-[20px] px-1 rounded-full text-[11px] grid place-items-center bg-[rgb(var(--bg-rgb))] text-[rgb(var(--fg-rgb))] border border-[rgb(var(--border-rgb))]"
              aria-label={`${unread} mensajes nuevos`}
              title={`${unread} nuevos`}
            >
              {unread}
            </span>
          )}
        </div>
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-4 z-50 w-[min(420px,calc(100vw-1.5rem))] rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] shadow-2xl overflow-hidden translate-y-2 opacity-0 animate-[fadeInUp_.15s_ease-out_forwards]"
          role="dialog"
          aria-label="Chat de soporte"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]" />

          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[rgb(var(--border-rgb))] bg-[rgb(var(--bg-rgb))]">
            <div className="flex items-center gap-3 min-w-0">
              {BRAND.avatar ? (
                <img
                  src={BRAND.avatar}
                  alt={BRAND.name}
                  className="h-9 w-9 rounded-full border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))]"
                />
              ) : (
                <div className="h-9 w-9 rounded-full grid place-items-center font-bold border border-[rgb(var(--border-rgb))] bg-[rgb(var(--muted-rgb))]">
                  {BRAND.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-5 truncate">
                  {BRAND.name} · Soporte
                </div>
                <div className="text-[11px] leading-4">
                  {online ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                      <CircleDot size={12} /> {subtitle}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                      <CircleDashed size={12} /> {subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              className="rounded-lg p-1.5 hover:bg-[rgb(var(--muted-rgb))]"
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </header>

          <div className="h-[64vh] grid grid-rows-[1fr_auto]">
            <div ref={listRef} className="overflow-auto p-3 sm:p-4 space-y-3">
              {!token && (
                <div className="p-4 rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] shadow-sm">
                  <div className="text-sm font-medium">
                    Para chatear con soporte, inicia sesión
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    Así podremos responderte aquí mismo.
                  </div>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 mt-3 rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-1.5 text-sm hover:bg-[rgb(var(--muted-rgb))]"
                    onClick={() => setOpen(false)}
                  >
                    <LogIn size={14} /> Iniciar sesión
                  </Link>
                </div>
              )}

              {token && isLoadingThread && (
                <div className="text-sm opacity-70 inline-flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Cargando…
                </div>
              )}

              {token && !isLoadingThread && !convId && (
                <div className="p-4 rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] shadow-sm">
                  <div className="text-sm font-medium">
                    {online
                      ? "Hola, ¿en qué podemos ayudarte?"
                      : "Estamos ausentes en este momento"}
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    {online
                      ? "Escríbenos y te respondemos aquí mismo."
                      : "Déjanos tu mensaje y te contestaremos apenas estemos en línea."}
                  </div>
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1.5 mt-3 rounded-xl text-sm border border-[rgb(var(--border-rgb))] hover:bg-[rgb(var(--muted-rgb))]"
                    onClick={() =>
                      document.getElementById("supportComposer")?.focus()
                    }
                    style={{ color: "rgb(226,145,65)" }}
                  >
                    Iniciar conversación
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path
                        d="M13.267 4.209a.75.75 0 0 0-1.034 1.086l6.251 5.955H3.75a.75.75 0 0 0 0 1.5h14.734l-6.251 5.954a.75.75 0 0 0 1.034 1.087l7.42-7.067a.996.996 0 0 0 .3-.58.758.758 0 0 0-.001-.29.995.995 0 0 0-.3-.578l-7.419-7.067Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {token &&
                !!convId &&
                !isLoadingThread &&
                convQ.data?.messages?.map((m, idx) => {
                  const mine = m.kind === MsgKind.USER;
                  const at = new Date(m.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  });
                  const prev = convQ.data?.messages?.[idx - 1];
                  const showGap =
                    !prev ||
                    new Date(m.createdAt).getTime() -
                      new Date(prev.createdAt).getTime() >
                      5 * 60 * 1000;
                  return (
                    <div key={m.id} className={showGap ? "mt-2" : ""}>
                      <div
                        className={[
                          "max-w-[88%] sm:max-w-[85%] rounded-2xl border px-3 py-2 text-sm shadow-sm",
                          mine
                            ? "ml-auto bg-[rgb(var(--muted-rgb))] border-[rgb(var(--border-rgb))]"
                            : "bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]",
                        ].join(" ")}
                        title={at}
                      >
                        <div className="text-[11px] opacity-60 mb-0.5">
                          {mine
                            ? "Tú"
                            : m.author?.name || m.author?.email || "Agente"}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {m.text}
                        </div>
                        <div className="mt-1 text-[10px] opacity-50">{at}</div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Composer */}
            <div className="border-t border-[rgb(var(--border-rgb))] p-3 bg-[rgb(var(--bg-rgb))]">
              {token ? (
                <div className="flex items-end gap-2">
                  <Textarea
                    id="supportComposer"
                    rows={2}
                    placeholder={
                      convId
                        ? "Escribe tu mensaje… (Ctrl/⌘ + Enter para enviar)"
                        : "Escribe el primer mensaje para iniciar el chat…"
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="rounded-xl"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    title="Enviar"
                    className="rounded-xl"
                  >
                    {sendMut.isPending || startMut.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <SendHorizonal size={16} />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-xs opacity-70">
                  Inicia sesión para chatear con soporte.
                </div>
              )}
              <div className="text-[11px] opacity-60 mt-1">
                Ctrl/⌘ + Enter para enviar
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Animación */
declare global {
  var __supportWidgetKF__: boolean | undefined;
}
if (typeof window !== "undefined" && !window.__supportWidgetKF__) {
  const style = document.createElement("style");
  style.innerHTML = `
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  `;
  document.head.appendChild(style);
  window.__supportWidgetKF__ = true;
}
