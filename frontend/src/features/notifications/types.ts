// src/features/notifications/types.ts

export type NotificationChannel = "IN_APP" | "EMAIL" | "PUSH";

export type NotificationType =
  | "ORDER_CREATED"
  | "ORDER_STATUS_UPDATED"
  | "WISHLIST_ITEM_ON_SALE"
  | "WISHLIST_ITEM_BACK_IN_STOCK"
  | "SUPPORT_MESSAGE"
  | "SECURITY"
  | string;

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, any> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}
