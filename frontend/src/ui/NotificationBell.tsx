import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/ui";

type Props = {
  unreadCount: number;
  onClick?: () => void;
};

export function NotificationBell({ unreadCount, onClick }: Props) {
  const [ring, setRing] = useState(false);
  const prevCount = useRef(unreadCount);
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    // Si sube el número de no leídas → animar “ring”
    if (unreadCount > prevCount.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 600);
      return () => clearTimeout(t);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  const displayCount =
    unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Notificaciones"
      className={`
        relative inline-flex h-9 w-9 items-center justify-center
        rounded-full
        hover:bg-[rgb(var(--card-2-rgb))]
        transition-colors
        ${ring ? "nav-icon-ring" : ""}
      `}
    >
      <Bell
        size={18}
        className={
          hasUnread
            ? "text-[rgb(var(--primary-rgb))]"
            : "text-[rgb(var(--fg-rgb)/0.9)]"
        }
      />
      {hasUnread && (
        <span className="absolute -right-1 -top-1">
          <Badge className="bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))] border-none text-[10px]">
            {displayCount}
          </Badge>
        </span>
      )}
    </button>
  );
}
