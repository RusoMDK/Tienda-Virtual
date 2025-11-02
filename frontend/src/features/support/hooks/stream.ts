// src/features/support/hooks/stream.ts
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import type { Conversation, Message } from "../types";
import type { ConvStatus, ConvPriority } from "../types";
import { apiBaseURL } from "@/lib/api";

// ─────────────────────────────────────────────────────────
// Tipos de eventos que emite el backend
// ─────────────────────────────────────────────────────────
type SupportEvent =
  | { type: "ready" }
  | { type: "message.created"; conversationId: string; message: Message }
  | { type: "conversation.created"; conversation: Conversation }
  | {
      type: "conversation.assigned";
      conversationId: string;
      assignedToId: string | null;
    }
  | { type: "conversation.status"; conversationId: string; status: ConvStatus }
  | {
      type: "conversation.priority";
      conversationId: string;
      priority: ConvPriority;
    }
  | { type: "conversation.tags"; conversationId: string; tags: string[] }
  | {
      type: "conversation.seen";
      conversationId: string;
      who: "STAFF" | "CUSTOMER";
      at: string;
    };

// ─────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────
function openEventSource(
  path: string,
  token: string,
  onEvent: (e: SupportEvent) => void
) {
  const url = `${apiBaseURL}${path}?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url, { withCredentials: false });

  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data) as SupportEvent;
      onEvent(data);
    } catch {
      // ignore parse errors
    }
  };
  // (opcional) debug reconexiones:
  // es.onerror = () => console.debug("SSE error:", path);

  return es;
}

function invalidateSupportLists(qc: ReturnType<typeof useQueryClient>) {
  // Soporta ambas keys por si tu app usa una u otra
  qc.invalidateQueries({ queryKey: ["support:conversations"] });
  qc.invalidateQueries({ queryKey: ["support:list"] });
}

function mapOverAllSupportLists<T = { items: Conversation[] }>(
  qc: ReturnType<typeof useQueryClient>,
  mapper: (c: Conversation) => Conversation
) {
  const candidates: QueryKey[] = [];

  for (const entry of qc.getQueriesData<T>({
    queryKey: ["support:conversations"],
  })) {
    candidates.push(entry[0]);
  }
  for (const entry of qc.getQueriesData<T>({ queryKey: ["support:list"] })) {
    candidates.push(entry[0]);
  }

  for (const key of candidates) {
    const cached: any = qc.getQueryData(key);
    if (!cached?.items) continue;
    const next = {
      ...cached,
      items: (cached.items as Conversation[]).map(mapper),
    };
    qc.setQueryData(key, next);
  }
}

// ─────────────────────────────────────────────────────────
// Hook: stream del INBOX (staff)
// ─────────────────────────────────────────────────────────
export function useSupportInboxStream() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const es = openEventSource("/support/stream", token, (ev) => {
      // Eventos que reordenan o cambian SLA → invalidamos listas
      if (
        ev.type === "conversation.created" ||
        ev.type === "message.created" ||
        ev.type === "conversation.tags" ||
        ev.type === "conversation.seen"
      ) {
        invalidateSupportLists(qc);
        return;
      }

      // Actualizaciones simples que podemos reflejar en cache sin refetch
      if (ev.type === "conversation.assigned") {
        mapOverAllSupportLists(qc, (c) =>
          c.id === ev.conversationId
            ? {
                ...c,
                assignedToId: ev.assignedToId,
                updatedAt: new Date().toISOString(),
              }
            : c
        );
        return;
      }

      if (ev.type === "conversation.status") {
        mapOverAllSupportLists(qc, (c) =>
          c.id === ev.conversationId
            ? { ...c, status: ev.status, updatedAt: new Date().toISOString() }
            : c
        );
        return;
      }

      if (ev.type === "conversation.priority") {
        mapOverAllSupportLists(qc, (c) =>
          c.id === ev.conversationId
            ? {
                ...c,
                priority: ev.priority,
                updatedAt: new Date().toISOString(),
              }
            : c
        );
        return;
      }
    });

    return () => es.close();
  }, [token, qc]);
}

// ─────────────────────────────────────────────────────────
// Hook: stream por CONVERSACIÓN (detalle)
// ─────────────────────────────────────────────────────────
export function useSupportConversationStream(conversationId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token || !conversationId) return;

    const es = openEventSource(
      `/support/conversations/${conversationId}/stream`,
      token,
      (ev) => {
        const key = ["support:conversation", conversationId];

        // Mensajes nuevos → push en cache si existe, y refresca listas
        if (
          ev.type === "message.created" &&
          ev.conversationId === conversationId
        ) {
          const cached: any = qc.getQueryData(key);
          if (cached?.messages) {
            qc.setQueryData(key, {
              ...cached,
              updatedAt: new Date().toISOString(),
              messages: [...cached.messages, ev.message],
              lastMessageAt: new Date().toISOString(),
            });
          } else {
            qc.invalidateQueries({ queryKey: key });
          }
          invalidateSupportLists(qc);
          return;
        }

        // Asignación
        if (
          ev.type === "conversation.assigned" &&
          ev.conversationId === conversationId
        ) {
          const cached: any = qc.getQueryData(key);
          if (cached) {
            qc.setQueryData(key, {
              ...cached,
              assignedToId: ev.assignedToId,
              updatedAt: new Date().toISOString(),
            });
          } else {
            qc.invalidateQueries({ queryKey: key });
          }
          invalidateSupportLists(qc);
          return;
        }

        // Estado
        if (
          ev.type === "conversation.status" &&
          ev.conversationId === conversationId
        ) {
          const cached: any = qc.getQueryData(key);
          if (cached) {
            qc.setQueryData(key, {
              ...cached,
              status: ev.status,
              updatedAt: new Date().toISOString(),
            });
          } else {
            qc.invalidateQueries({ queryKey: key });
          }
          invalidateSupportLists(qc);
          return;
        }

        // Prioridad
        if (
          ev.type === "conversation.priority" &&
          ev.conversationId === conversationId
        ) {
          const cached: any = qc.getQueryData(key);
          if (cached) {
            qc.setQueryData(key, {
              ...cached,
              priority: ev.priority,
              updatedAt: new Date().toISOString(),
            });
          } else {
            qc.invalidateQueries({ queryKey: key });
          }
          invalidateSupportLists(qc);
          return;
        }

        // Tags → mapeo ligero + refetch para IDs reales
        if (
          ev.type === "conversation.tags" &&
          ev.conversationId === conversationId
        ) {
          const cached: any = qc.getQueryData(key);
          if (cached) {
            qc.setQueryData(key, {
              ...cached,
              tags: ev.tags.map((t) => ({ id: `tmp:${t}`, tag: t })),
              updatedAt: new Date().toISOString(),
            });
          }
          qc.invalidateQueries({ queryKey: key });
          invalidateSupportLists(qc);
          return;
        }

        // Seen
        if (
          ev.type === "conversation.seen" &&
          ev.conversationId === conversationId
        ) {
          const cached: any = qc.getQueryData(key);
          if (cached) {
            const patch =
              ev.who === "STAFF"
                ? { lastSeenByStaffAt: ev.at }
                : { lastSeenByCustomerAt: ev.at };
            qc.setQueryData(key, { ...cached, ...patch });
          } else {
            qc.invalidateQueries({ queryKey: key });
          }
          return;
        }
      }
    );

    return () => es.close();
  }, [token, conversationId, qc]);
}
