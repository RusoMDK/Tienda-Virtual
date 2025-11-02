// src/features/support/api.ts
import { api } from "@/lib/api";
import type {
  Conversation,
  Message,
  Paged,
  UserLite,
  NewAttachment,
} from "./types";
import { ConvStatus, MsgKind, ConvPriority } from "./types";

/* =========================================
 * Helpers
 * ======================================= */
function mapAttForBackend(att: NewAttachment) {
  // El backend espera { url, mime?, size? }. Mapeamos bytes → size.
  return {
    url: att.url,
    mime: att.mime ?? "application/octet-stream",
    size: typeof att.bytes === "number" ? att.bytes : 0,
  };
}

/* =========================================
 * Tipos de params públicos (útil para hooks)
 * ======================================= */
export type ListParams = {
  box?: "unassigned" | "mine" | "all";
  status?: ConvStatus;
  q?: string;
  p?: number;
  ps?: number;
  // Filtros/orden SLA y metadata
  sla?: "breached" | "atRisk" | "ok";
  sort?: "timeToBreachAsc" | "lastMessageDesc";
  priority?: ConvPriority;
  tag?: string;
};

/* =========================================
 * API Support
 * ======================================= */

// Crear conversación (cliente logueado)
export async function createConversation(payload: {
  subject?: string;
  firstMessage: string;
  priority?: ConvPriority; // opcional, default NORMAL en el BE
}) {
  const { data } = await api.post<Conversation>(
    "/support/conversations",
    payload
  );
  return data;
}

// Mi última conversación (para el widget cliente)
export async function getMyLatestConversation() {
  const { data } = await api.get<{
    conversation: Conversation | null;
    messages: Message[];
  }>("/support/my/latest");
  return data;
}

// Listar conversaciones (support/admin) con filtros modernos
export async function listConversations(params: ListParams = {}) {
  const { data } = await api.get<Paged<Conversation>>(
    "/support/conversations",
    { params }
  );
  return data;
}

// Obtener conversación + mensajes
export async function getConversation(id: string) {
  const { data } = await api.get<Conversation & { messages: Message[] }>(
    `/support/conversations/${id}`
  );
  return data;
}

// Enviar mensaje (texto + adjuntos)
export async function sendMessage(
  id: string,
  payload: {
    text?: string;
    kind?: MsgKind | "INTERNAL_NOTE"; // alias legacy
    attachments?: NewAttachment[];
  }
) {
  // Normaliza "INTERNAL_NOTE" → "INTERNAL"
  const normalizedKind =
    payload?.kind === "INTERNAL_NOTE" ? MsgKind.INTERNAL : payload?.kind;

  const body = {
    text: payload.text,
    kind: normalizedKind,
    attachments: (payload.attachments || []).map(mapAttForBackend),
  };

  const { data } = await api.post<Message>(
    `/support/conversations/${id}/messages`,
    body
  );
  return data;
}

// Asignar conversación (agente o null para desasignar)
export async function assignConversation(id: string, agentId: string | null) {
  const { data } = await api.post<Conversation>(
    `/support/conversations/${id}/assign`,
    { agentId }
  );
  return data;
}

// Cambiar estado
export async function setConversationStatus(id: string, status: ConvStatus) {
  const { data } = await api.post<Conversation>(
    `/support/conversations/${id}/status`,
    { status }
  );
  return data;
}

// ✅ Alias para compatibilidad con imports antiguos
export const changeStatus = setConversationStatus;

// Cambiar prioridad
export async function setConversationPriority(
  id: string,
  priority: ConvPriority
) {
  const { data } = await api.post<Conversation>(
    `/support/conversations/${id}/priority`,
    { priority }
  );
  return data;
}

// Tags (añadir / quitar)
export async function updateConversationTags(
  id: string,
  payload: { add?: string[]; remove?: string[] }
) {
  const { data } = await api.post<{
    ok: boolean;
    tags: { id: string; tag: string }[];
  }>(`/support/conversations/${id}/tags`, {
    add: payload.add || [],
    remove: payload.remove || [],
  });
  return data;
}

// Listar agentes (support/admin)
export async function listAgents(
  params: { q?: string; p?: number; ps?: number } = {}
) {
  const { data } = await api.get<Paged<UserLite>>("/support/agents", {
    params,
  });
  return data;
}

// Listar tags globales
export async function listSupportTags() {
  const { data } = await api.get<Array<{ tag: string; count: number }>>(
    "/support/tags"
  );
  return data;
}
// Alias friendly si en otros lados usas listTags()
export const listTags = listSupportTags;

// (Opcional) obtener usuario actual para “Asignarme”
export async function getMe() {
  const { data } = await api.get<{
    id: string;
    name: string | null;
    email: string;
    role: "ADMIN" | "SUPPORT" | "CUSTOMER";
  }>("/me");
  return data;
}

// Marcar conversación como vista (dueño o staff)
export async function markSeen(id: string) {
  const { data } = await api.post<{
    ok: boolean;
    lastSeenByCustomerAt?: string;
    lastSeenByStaffAt?: string;
  }>(`/support/conversations/${id}/seen`, {});
  return data;
}
