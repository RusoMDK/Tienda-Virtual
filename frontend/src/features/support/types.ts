// src/features/support/types.ts

export enum ConvStatus {
  OPEN = "OPEN",
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

// Mantén MsgKind alineado con el backend
export enum MsgKind {
  USER = "USER",
  AGENT = "AGENT",
  SYSTEM = "SYSTEM",
  INTERNAL = "INTERNAL",
}

// Priorización (usa los mismos valores del Prisma)
export enum ConvPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export type UserLite = {
  id: string;
  name: string | null;
  email: string;
  role?: "ADMIN" | "SUPPORT" | "CUSTOMER";
};

export type Attachment = {
  id?: string;
  url: string;
  mime?: string | null;
  bytes?: number | null;
  publicId?: string | null;
  filename?: string | null;
  width?: number | null;
  height?: number | null;
};

export type NewAttachment = Omit<Attachment, "id">;

export type Message = {
  id: string;
  conversationId: string;
  authorId: string | null;
  author?: UserLite | null;
  kind: MsgKind;
  text: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: Attachment[];
};

export type ConversationTag = {
  id: string;
  tag: string;
};

export type Conversation = {
  id: string;
  subject?: string | null;

  status: ConvStatus;
  channel?: "WEB" | "WHATSAPP" | "TELEGRAM" | "EMAIL";
  priority?: ConvPriority;

  userId?: string | null;
  user?: UserLite | null;
  assignedToId?: string | null;
  assignedTo?: UserLite | null;

  // Métricas / SLA (opcionales según backend)
  lastMessageAt?: string | null;
  lastCustomerMessageAt?: string | null;
  lastAgentMessageAt?: string | null;

  firstResponseAt?: string | null;
  firstResponseSlaAt?: string | null;
  resolutionSlaAt?: string | null;
  resolvedAt?: string | null;

  // Visto
  lastSeenByCustomerAt?: string | null;
  lastSeenByStaffAt?: string | null;

  // Tags (pueden venir como objetos)
  tags?: ConversationTag[];

  createdAt: string;
  updatedAt: string;

  _count?: { messages: number };
};

export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
