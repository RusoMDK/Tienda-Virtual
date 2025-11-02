import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";

type Item = { label: string; onSelect: () => void; disabled?: boolean };

export default function Dropdown({
  trigger,
  items,
  align = "right",
}: {
  trigger: React.ReactNode;
  items: Item[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-[rgb(var(--line-rgb))]",
            "bg-[rgb(var(--card-rgb))] shadow-xl origin-top",
            "opacity-0 translate-y-1 scale-[0.98] animate-[dropdownIn_.14s_ease-out_forwards]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                if (!it.disabled) it.onSelect();
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                "hover:bg-[rgb(var(--muted-rgb))]/70",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Anim keyframes (añade esto 1 sola vez a tu CSS global si no lo tienes):
@keyframes dropdownIn {
  to { opacity: 1; transform: translateY(0) scale(1); }
}
*/
