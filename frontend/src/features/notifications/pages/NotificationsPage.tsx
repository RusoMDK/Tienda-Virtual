import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Container from "@/layout/Container";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "../hooks";
import type { NotificationDto } from "../types";
import {
  Bell,
  Package,
  MessageCircle,
  ShieldCheck,
  Star,
  Heart,
  Info,
} from "lucide-react";

type Filter = "all" | "unread";

function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((p) => Number(p));
  const d = new Date(year, month - 1, day);
  const today = new Date();

  const dayStart = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  ).getTime();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  const diffDays = Math.round((todayStart - dayStart) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryMeta(category?: string | null): {
  label: string;
  tone: "blue" | "green" | "amber" | "rose" | "indigo" | "gray";
  icon: JSX.Element;
} {
  const baseIconClass = "h-3.5 w-3.5";

  switch (category) {
    case "ORDER":
      return {
        label: "Pedido",
        tone: "blue",
        icon: <Package className={baseIconClass} />,
      };
    case "SUPPORT":
      return {
        label: "Soporte",
        tone: "green",
        icon: <MessageCircle className={baseIconClass} />,
      };
    case "SECURITY":
      return {
        label: "Seguridad",
        tone: "amber",
        icon: <ShieldCheck className={baseIconClass} />,
      };
    case "WISHLIST":
      return {
        label: "Favoritos",
        tone: "rose",
        icon: <Heart className={baseIconClass} />,
      };
    case "PROMO":
      return {
        label: "Promoción",
        tone: "indigo",
        icon: <Star className={baseIconClass} />,
      };
    default:
      return {
        label: "General",
        tone: "gray",
        icon: <Info className={baseIconClass} />,
      };
  }
}

function toneToClasses(
  tone: ReturnType<typeof getCategoryMeta>["tone"],
  kind: "soft" | "dot"
) {
  if (kind === "dot") {
    switch (tone) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-emerald-500";
      case "amber":
        return "bg-amber-500";
      case "rose":
        return "bg-rose-500";
      case "indigo":
        return "bg-indigo-500";
      case "gray":
      default:
        return "bg-gray-400";
    }
  }

  // soft pill background
  switch (tone) {
    case "blue":
      return "bg-blue-100/60 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200";
    case "green":
      return "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200";
    case "amber":
      return "bg-amber-100/60 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200";
    case "rose":
      return "bg-rose-100/60 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200";
    case "indigo":
      return "bg-indigo-100/60 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200";
    case "gray":
    default:
      return "bg-gray-100/60 text-gray-800 dark:bg-gray-500/10 dark:text-gray-200";
  }
}

export default function NotificationsPage() {
  const { accessToken } = useAuth();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");

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

  const filtered = useMemo(
    () => notifications.filter((n) => (filter === "unread" ? !n.readAt : true)),
    [notifications, filter]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationDto[]> = {};

    for (const n of filtered) {
      const d = new Date(n.createdAt);
      const key = d.toISOString().slice(0, 10); // yyyy-mm-dd
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    }

    return Object.entries(groups)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // desc por fecha
      .map(([key, list]) => ({
        dateKey: key,
        label: formatDayLabel(key),
        items: list.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }));
  }, [filtered]);

  const handleNavigate = (n: NotificationDto) => {
    const data = (n.data ?? {}) as any;

    if (data.orderId) {
      nav(`/orders/${data.orderId}`);
      return;
    }
    if (data.productSlug) {
      nav(`/product/${data.productSlug}`);
      return;
    }
    if (data.productId) {
      nav(`/product/${data.productId}`);
      return;
    }
    if (data.conversationId) {
      nav(`/support/conversations/${data.conversationId}`);
      return;
    }
  };

  const handleClick = (n: NotificationDto) => {
    if (!n.readAt) {
      markAsRead(n.id);
    }
    handleNavigate(n);
  };

  const totalCount = notifications.length;

  return (
    <Container className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 sm:mb-7">
        <div className="flex items-start gap-3">
          <div
            className="
              hidden sm:flex h-10 w-10 items-center justify-center rounded-2xl
              bg-[rgb(var(--primary-rgb)/0.08)]
              text-[rgb(var(--primary-rgb))]
            "
          >
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
              Centro de notificaciones
            </h1>
            <p className="text-xs sm:text-sm text-[rgb(var(--fg-rgb)/0.7)] mt-1">
              Revisa actualizaciones de pedidos, soporte, seguridad y más en un
              solo lugar.
            </p>
            {totalCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] sm:text-xs">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-rgb))]" />
                  {totalCount} notificación
                  {totalCount === 1 ? "" : "es"} en total
                </span>
                <span className="inline-flex items-center gap-1 text-[rgb(var(--fg-rgb)/0.6)]">
                  <span className="inline-flex h-1 w-1 rounded-full bg-[rgb(var(--fg-rgb)/0.35)]" />
                  {unreadCount > 0
                    ? `${unreadCount} sin leer`
                    : "Todo al día ✨"}
                </span>
              </div>
            )}
          </div>
        </div>

        {hasUnread && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            className="
              text-[11px] sm:text-xs md:text-sm rounded-full px-3 py-1
              border border-[rgb(var(--border-rgb))]
              bg-[rgb(var(--card-2-rgb))]
              hover:bg-[rgb(var(--muted-rgb))]
              whitespace-nowrap
            "
          >
            Marcar todo como leído
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
        <div
          className="
            inline-flex items-center rounded-full
            border border-[rgb(var(--border-rgb))]
            bg-[rgb(var(--card-2-rgb))]
            p-0.5 text-xs sm:text-sm
          "
        >
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`
              px-3 py-1 rounded-full flex items-center gap-1.5
              ${
                filter === "all"
                  ? "bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))]"
                  : "text-[rgb(var(--fg-rgb))]"
              }
            `}
          >
            <span>Todas</span>
            <span className="text-[10px] opacity-80">
              {totalCount > 0 ? totalCount : "0"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`
              px-3 py-1 rounded-full flex items-center gap-1.5
              ${
                filter === "unread"
                  ? "bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))]"
                  : "text-[rgb(var(--fg-rgb))]"
              }
            `}
          >
            <span>No leídas</span>
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-rgb))]" />
          </button>
        </div>
      </div>

      {/* Card principal */}
      <div
        className="
          rounded-2xl border border-[rgb(var(--border-rgb))]
          bg-[rgb(var(--card-rgb))]
          overflow-hidden
        "
      >
        {/* Vacío */}
        {grouped.length === 0 && !loading && (
          <div className="px-6 py-10 sm:py-12 flex flex-col items-center text-center gap-3">
            <div
              className="
                h-12 w-12 rounded-2xl
                bg-[rgb(var(--card-2-rgb))]
                border border-[rgb(var(--border-rgb))]
                flex items-center justify-center
                mb-1
              "
            >
              <Bell className="h-6 w-6 text-[rgb(var(--fg-rgb)/0.8)]" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold">
              {filter === "unread"
                ? "No tienes notificaciones pendientes"
                : "Todavía no tienes notificaciones"}
            </h2>
            <p className="text-xs sm:text-sm text-[rgb(var(--fg-rgb)/0.7)] max-w-sm">
              {filter === "unread"
                ? "Cuando haya algo nuevo sobre tus pedidos, soporte o seguridad, aparecerá aquí."
                : "A medida que uses la tienda iremos mostrándote novedades importantes en este espacio."}
            </p>
          </div>
        )}

        {/* Grupos por día */}
        {grouped.map((group) => (
          <div
            key={group.dateKey}
            className="border-t first:border-t-0 border-[rgb(var(--border-rgb))]"
          >
            <div className="px-4 sm:px-5 pt-3 pb-1 text-[11px] sm:text-xs font-medium text-[rgb(var(--fg-rgb)/0.6)] uppercase tracking-wide">
              {group.label}
            </div>
            <ul className="divide-y divide-[rgb(var(--border-rgb)/0.7)]">
              {group.items.map((n) => {
                const isUnread = !n.readAt;
                const meta = getCategoryMeta((n as any).category);

                return (
                  <li key={n.id}>
                    <div
                      className={`
                        flex items-stretch
                        ${
                          isUnread
                            ? "bg-[rgb(var(--primary-rgb)/0.04)] hover:bg-[rgb(var(--primary-rgb)/0.08)]"
                            : "hover:bg-[rgb(var(--muted-rgb)/0.7)]"
                        }
                        transition-colors
                      `}
                    >
                      {/* Banda lateral de leído/no leído */}
                      <div
                        className={`
                          w-1 sm:w-1.5
                          ${
                            isUnread
                              ? "bg-[rgb(var(--primary-rgb))]"
                              : "bg-transparent"
                          }
                          rounded-r-full
                        `}
                      />

                      <button
                        type="button"
                        onClick={() => handleClick(n)}
                        className="flex-1 text-left px-4 sm:px-5 py-3.5"
                      >
                        <div className="flex items-start gap-3">
                          {/* Icono categoría */}
                          <div className="mt-0.5">
                            <div
                              className={`
                                h-8 w-8 rounded-2xl flex items-center justify-center
                                ${toneToClasses(meta.tone, "soft")}
                              `}
                            >
                              {meta.icon}
                            </div>
                          </div>

                          {/* Contenido */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p
                                  className={`
                                    text-sm sm:text-[15px] font-semibold truncate
                                    ${
                                      isUnread
                                        ? "text-[rgb(var(--fg-rgb))]"
                                        : "text-[rgb(var(--fg-rgb)/0.95)]"
                                    }
                                  `}
                                >
                                  {n.title}
                                </p>
                                <p className="mt-0.5 text-xs sm:text-[13px] text-[rgb(var(--fg-rgb)/0.75)] line-clamp-2">
                                  {n.body}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-[10px] sm:text-[11px] text-[rgb(var(--fg-rgb)/0.5)]">
                                  {formatTime(n.createdAt)}
                                </span>
                                {isUnread && (
                                  <span
                                    className={`
                                      inline-flex h-2 w-2 rounded-full
                                      ${toneToClasses(meta.tone, "dot")}
                                    `}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Meta + acciones */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`
                                  inline-flex items-center gap-1.5 rounded-full
                                  px-2 py-0.5 text-[10px] sm:text-[11px]
                                  ${toneToClasses(meta.tone, "soft")}
                                `}
                              >
                                {meta.icon}
                                <span>{meta.label}</span>
                              </span>

                              {isUnread && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(n.id);
                                  }}
                                  className="
                                    text-[10px] sm:text-[11px]
                                    text-[rgb(var(--primary-rgb))]
                                    hover:text-[rgb(var(--primary-rgb)/0.9)]
                                  "
                                >
                                  Marcar como leído
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigate(n);
                                }}
                                className="
                                  text-[10px] sm:text-[11px]
                                  text-[rgb(var(--fg-rgb)/0.7)]
                                  hover:text-[rgb(var(--fg-rgb))]
                                  underline underline-offset-2
                                "
                              >
                                Ver detalle
                              </button>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Loading + paginación */}
        {loading && (
          <div className="px-4 sm:px-5 py-3 text-[11px] sm:text-xs text-[rgb(var(--fg-rgb)/0.7)]">
            Cargando notificaciones…
          </div>
        )}

        {hasMore && (
          <div className="border-t border-[rgb(var(--border-rgb))] px-4 sm:px-5 py-2.5 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="
                text-xs sm:text-sm
                text-[rgb(var(--primary-rgb))]
                hover:text-[rgb(var(--primary-rgb)/0.9)]
                disabled:opacity-60
              "
            >
              {loading ? "Cargando…" : "Cargar más notificaciones"}
            </button>
          </div>
        )}
      </div>
    </Container>
  );
}
