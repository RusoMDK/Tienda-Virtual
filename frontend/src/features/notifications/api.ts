// src/features/notifications/api.ts
import type { NotificationDto, NotificationListResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: any;
  accessToken?: string | null;
  signal?: AbortSignal;
};

async function apiFetch<T>(
  path: string,
  { method = "GET", body, accessToken, signal }: FetchOptions = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error ${res.status}: ${text || res.statusText || "Unknown"}`
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function fetchNotifications(
  params: { page?: number; pageSize?: number; onlyUnread?: boolean } = {},
  accessToken?: string | null
): Promise<NotificationListResponse> {
  const { page = 1, pageSize = 20, onlyUnread } = params;
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(pageSize));
  if (onlyUnread) searchParams.set("onlyUnread", "true");

  return apiFetch<NotificationListResponse>(
    `/me/notifications?${searchParams.toString()}`,
    { accessToken }
  );
}

export async function markNotificationRead(
  id: string,
  accessToken?: string | null
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/me/notifications/${id}/read`, {
    method: "POST",
    accessToken,
  });
}

export async function markAllNotificationsRead(
  accessToken?: string | null
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/me/notifications/read-all", {
    method: "POST",
    accessToken,
  });
}

// opcional: traer una sola notificación si lo necesitas
export async function fetchNotificationById(
  id: string,
  accessToken?: string | null
): Promise<NotificationDto> {
  return apiFetch<NotificationDto>(`/me/notifications/${id}`, {
    accessToken,
  });
}

// exportamos base URL para el SSE
export { API_BASE_URL };
