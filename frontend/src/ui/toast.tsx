// src/lib/ToastProvider.tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { cn } from "../utils/cn";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error";
};

type Ctx = { toast: (t: Omit<Toast, "id">) => void };

const ToastCtx = createContext<Ctx | null>(null);

function ToastItem({ t, onDone }: { t: Toast; onDone: (id: string) => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // enter
    const raf = requestAnimationFrame(() => setShow(true));
    // leave + remove
    const leave = setTimeout(() => setShow(false), 3200);
    const remove = setTimeout(() => onDone(t.id), 3600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [t.id, onDone]);

  return (
    <div
      className={cn(
        // tamaño: largo cómodo, como antes
        "relative rounded-lg border w-[92vw] max-w-[360px] px-3.5 py-2.5 text-sm shadow-lg",
        "bg-[rgb(var(--card-rgb))] border-[rgb(var(--line-rgb))]",
        // animación tipo persiana desde la derecha
        "transition-all duration-300 ease-out",
        "will-change-transform will-change-opacity origin-right",
        show
          ? "opacity-100 translate-x-0 scale-x-100"
          : "opacity-0 translate-x-6 scale-x-95",
        // barra lateral de color según variante
        t.variant === "success" &&
          "border-l-2 border-l-[rgb(var(--primary-rgb))]",
        t.variant === "error" &&
          "border-l-2 border-l-[rgb(var(--danger-rgb,220_38_38))]",
        t.variant === "default" &&
          "border-l-2 border-l-[rgb(var(--fg-rgb)/0.4)]"
      )}
      role="status"
      aria-live="polite"
    >
      {t.title && (
        <div className="font-semibold mb-0.5 text-[rgb(var(--fg-rgb))]">
          {t.title}
        </div>
      )}
      {t.description && (
        <div className="text-[13px] leading-snug text-[rgb(var(--fg-rgb)/0.8)]">
          {t.description}
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const [navVisible, setNavVisible] = useState(true);

  // Detectar si el navbar está visible/oculto (igual lógica que el navbar)
  useEffect(() => {
    let lastScrollY = window.scrollY || 0;

    const handleScroll = () => {
      const current = window.scrollY || 0;
      const diff = current - lastScrollY;

      if (Math.abs(diff) < 4) {
        lastScrollY = current;
        return;
      }

      if (current < 40) {
        setNavVisible(true);
      } else if (diff > 0 && current > 80) {
        setNavVisible(false);
      } else if (diff < 0) {
        setNavVisible(true);
      }

      lastScrollY = current;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setItems((arr) => [...arr, { id, ...t }]);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
  }, []);

  const ctx = useMemo(() => ({ toast }), [toast]);

  // Si navbar visible → un poco por debajo.
  // Si oculto → cercano al top para molestar lo menos posible.
  const topOffset = navVisible ? "6rem" : "0.75rem";

  return (
    <ToastCtx.Provider value={ctx}>
      {children}

      <div
        className="
          fixed right-0 sm:right-4 z-[60]
          space-y-2 flex flex-col items-end
          pointer-events-none
        "
        style={{ top: topOffset }}
      >
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDone={remove} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx.toast;
}
