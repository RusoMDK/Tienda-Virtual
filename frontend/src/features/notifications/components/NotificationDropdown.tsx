import { useState } from "react";
import { NotificationBell } from "@/ui/NotificationBell";
import { useNotifications } from "../hooks";
import type { NotificationDto } from "../types";

type Props = {
  accessToken?: string | null;
  onNotificationNavigate?: (n: NotificationDto) => void;
  onViewAll?: () => void;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export function NotificationDropdown({
  accessToken,
  onNotificationNavigate,
  onViewAll,
}: Props) {
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    hasUnread,
    loading,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ accessToken });

  const handleClickNotification = (n: NotificationDto) => {
    if (!n.readAt) {
      markAsRead(n.id);
    }

    if (onNotificationNavigate) {
      onNotificationNavigate(n);
    }

    setOpen(false);
  };

  return (
    <div className="relative">
      <NotificationBell
        unreadCount={unreadCount}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          className="
            absolute right-0 mt-2 w-80 sm:w-96 z-40
            rounded-xl border border-[rgb(var(--border-rgb))]
            bg-[rgb(var(--card-rgb))] shadow-lg
            overflow-hidden
          "
        >
          {/* header */}
          <div
            className="
              flex items-center justify-between px-3 py-2
              border-b border-[rgb(var(--border-rgb))]
            "
          >
            <span className="text-sm font-medium text-[rgb(var(--fg-rgb))]">
              Notificaciones
            </span>
            {notifications.length > 0 && hasUnread && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="
                  text-[11px] sm:text-xs
                  text-[rgb(var(--primary-rgb))]
                  hover:text-[rgb(var(--primary-rgb)/0.9)]
                "
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {/* lista */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 && !loading && (
              <div className="px-4 py-6 text-center text-sm text-[rgb(var(--fg-rgb)/0.7)]">
                No tienes notificaciones por ahora.
              </div>
            )}

            {notifications.map((n) => {
              const isUnread = !n.readAt;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickNotification(n)}
                  className={`
                    w-full flex text-left px-3 py-2
                    border-b last:border-b-0
                    border-[rgb(var(--border-rgb))/0.7]
                    transition-colors
                    ${
                      isUnread
                        ? "bg-[rgb(var(--primary-rgb)/0.06)] hover:bg-[rgb(var(--primary-rgb)/0.12)]"
                        : "bg-[rgb(var(--card-rgb))] hover:bg-[rgb(var(--muted-rgb)/0.7)]"
                    }
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`
                          text-xs font-semibold
                          ${
                            isUnread
                              ? "text-[rgb(var(--fg-rgb))]"
                              : "text-[rgb(var(--fg-rgb)/0.9)]"
                          }
                        `}
                      >
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-[rgb(var(--primary-rgb))]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[rgb(var(--fg-rgb)/0.75)] line-clamp-2">
                      {n.body}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[rgb(var(--fg-rgb)/0.5)]">
                        {formatDate(n.createdAt)}
                      </span>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                          }}
                          className="
                            text-[11px]
                            text-[rgb(var(--primary-rgb))]
                            hover:text-[rgb(var(--primary-rgb)/0.9)]
                          "
                        >
                          Marcar leído
                        </button>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {loading && (
              <div className="px-4 py-3 text-xs text-[rgb(var(--fg-rgb)/0.7)]">
                Cargando notificaciones…
              </div>
            )}
          </div>

          {/* footer: ver más / ver todas */}
          {(hasMore || onViewAll) && (
            <div
              className="
                flex items-center gap-2
                border-t border-[rgb(var(--border-rgb))]
                bg-[rgb(var(--card-2-rgb))]
                px-3 py-2
              "
            >
              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading}
                  className="
                    text-[11px] sm:text-xs
                    text-[rgb(var(--primary-rgb))]
                    hover:text-[rgb(var(--primary-rgb)/0.9)]
                    disabled:opacity-60
                  "
                >
                  {loading ? "Cargando…" : "Ver más"}
                </button>
              )}

              {onViewAll && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onViewAll();
                  }}
                  className="
                    ml-auto text-[11px] sm:text-xs font-medium
                    text-[rgb(var(--fg-rgb))]
                    hover:text-[rgb(var(--primary-rgb))]
                  "
                >
                  Ver todas
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
