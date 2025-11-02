// src/features/support/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listConversations,
  getConversation,
  sendMessage,
  assignConversation,
  changeStatus, // alias a setConversationStatus
  setConversationPriority,
  updateConversationTags,
  getMe,
} from "../api";
import type { ListParams } from "../api";
import {
  ConvStatus,
  ConvPriority,
  MsgKind,
  type NewAttachment,
} from "../types";

/**
 * Lista de conversaciones con filtros avanzados:
 * - box: "unassigned" | "mine" | "all"
 * - status: ConvStatus
 * - priority: ConvPriority
 * - sla: "breached" | "atRisk" | "ok"
 * - sort: "timeToBreachAsc" | "lastMessageDesc"
 * - tag: string
 * - q, p, ps
 */
export function useSupportList(params: ListParams) {
  return useQuery({
    queryKey: ["support:conversations", params],
    queryFn: () => listConversations(params),
    keepPreviousData: true,
    staleTime: 10_000,
  });
}

export function useConversation(id?: string) {
  return useQuery({
    queryKey: ["support:conversation", id],
    queryFn: () => (id ? getConversation(id) : Promise.resolve(null)),
    enabled: !!id,
    // Puedes desactivar el polling si usas SSE en el detalle.
    refetchInterval: 5000,
  });
}

export function useMeLite() {
  return useQuery({ queryKey: ["me:lite"], queryFn: getMe, staleTime: 60_000 });
}

/**
 * Enviar mensaje (con adjuntos y tipos de mensaje, incluyendo INTERNAL_NOTE).
 */
export function useSendMessage(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      text?: string;
      kind?: MsgKind | "INTERNAL_NOTE";
      attachments?: NewAttachment[];
    }) => {
      if (!id) throw new Error("No conversation id");
      return sendMessage(id, p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      // invalidamos ambas variantes de lista por si tu app usa cualquiera
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
      qc.invalidateQueries({ queryKey: ["support:list"] });
    },
  });
}

export function useAssign(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string | null) => {
      if (!id) throw new Error("No conversation id");
      return assignConversation(id, agentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
      qc.invalidateQueries({ queryKey: ["support:list"] });
    },
  });
}

export function useChangeStatus(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: ConvStatus) => {
      if (!id) throw new Error("No conversation id");
      return changeStatus(id, status);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
      qc.invalidateQueries({ queryKey: ["support:list"] });
    },
  });
}

/** Cambiar prioridad de una conversación */
export function useSetPriority(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (priority: ConvPriority) => {
      if (!id) throw new Error("No conversation id");
      return setConversationPriority(id, priority);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
      qc.invalidateQueries({ queryKey: ["support:list"] });
    },
  });
}

/** Añadir / quitar tags de una conversación */
export function useUpdateTags(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { add?: string[]; remove?: string[] }) => {
      if (!id) throw new Error("No conversation id");
      return updateConversationTags(id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support:conversation", id] });
      qc.invalidateQueries({ queryKey: ["support:conversations"] });
      qc.invalidateQueries({ queryKey: ["support:list"] });
    },
  });
}
