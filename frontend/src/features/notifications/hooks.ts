// src/features/notifications/hooks.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NotificationDto } from "./types";
import {
  API_BASE_URL,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api";

type UseNotificationsOptions = {
  accessToken?: string | null;
};

type NotificationEventPayload =
  | { type: "ready" }
  | { type: "notification.created"; notification: NotificationDto }
  | { type: "notification.updated"; notification: NotificationDto }
  | { type: "notification.read"; notificationId: string }
  | { type: "notifications.unread_count"; unreadCount: number };

export function useNotifications({ accessToken }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const isAuthenticated = !!accessToken;

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!accessToken) return;

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetchNotifications(
          { page: nextPage, pageSize },
          accessToken
        );

        setUnreadCount(res.unreadCount);
        setHasMore(res.page < res.totalPages);

        setNotifications((prev) =>
          replace ? res.items : [...prev, ...res.items]
        );
        setPage(res.page);
        setInitialLoaded(true);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("[notifications] load error", err);
        setError(err?.message || "Error al cargar notificaciones");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, pageSize]
  );

  const reload = useCallback(() => {
    if (!accessToken) return;
    loadPage(1, true);
  }, [accessToken, loadPage]);

  const loadMore = useCallback(() => {
    if (!accessToken || loading || !hasMore) return;
    loadPage(page + 1, false);
  }, [accessToken, loading, hasMore, page, loadPage]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!accessToken) return;

      // update optimista
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.readAt
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await markNotificationRead(id, accessToken);
      } catch (err) {
        console.error("[notifications] mark read error", err);
        // fallback simple: recargar
        reload();
      }
    },
    [accessToken, reload]
  );

  const markAllAsRead = useCallback(async () => {
    if (!accessToken) return;

    setNotifications((prev) =>
      prev.map((n) =>
        n.readAt ? n : { ...n, readAt: new Date().toISOString() }
      )
    );
    setUnreadCount(0);

    try {
      await markAllNotificationsRead(accessToken);
    } catch (err) {
      console.error("[notifications] mark all read error", err);
      reload();
    }
  }, [accessToken, reload]);

  // primera carga
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(false);
      setInitialLoaded(false);
      return;
    }
    loadPage(1, true);
  }, [isAuthenticated, loadPage]);

  // SSE
  useEffect(() => {
    if (!accessToken) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const url = `${API_BASE_URL}/me/notifications/stream?token=${encodeURIComponent(
      accessToken
    )}`;

    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      console.debug("[notifications] SSE open");
    };

    es.onerror = (event) => {
      console.error("[notifications] SSE error", event);
    };

    es.onmessage = (event) => {
      if (!event.data) return;
      try {
        const payload: NotificationEventPayload = JSON.parse(event.data);

        switch (payload.type) {
          case "ready":
            return;
          case "notification.created": {
            const n = payload.notification;
            setNotifications((prev) => {
              const exists = prev.some((x) => x.id === n.id);
              if (exists) return prev;
              return [n, ...prev];
            });
            if (!n.readAt) {
              setUnreadCount((prev) => prev + 1);
            }
            return;
          }
          case "notification.updated": {
            const n = payload.notification;
            setNotifications((prev) =>
              prev.map((x) => (x.id === n.id ? n : x))
            );
            return;
          }
          case "notification.read": {
            const id = payload.notificationId;
            setNotifications((prev) =>
              prev.map((x) =>
                x.id === id && !x.readAt
                  ? { ...x, readAt: new Date().toISOString() }
                  : x
              )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
            return;
          }
          case "notifications.unread_count": {
            setUnreadCount(payload.unreadCount);
            return;
          }
          default:
            return;
        }
      } catch (err) {
        console.error("[notifications] SSE parse error", err);
      }
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [accessToken]);

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);

  return {
    notifications,
    unreadCount,
    hasUnread,
    loading,
    error,
    initialLoaded,
    hasMore,
    page,
    pageSize,
    reload,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}
