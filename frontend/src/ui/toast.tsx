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
    const remove = setTimeout(() => onDone(t.id), 3400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [t.id, onDone]);

  return (
    <div
      className={cn(
        "rounded-xl border w-[92vw] max-w-[360px] px-3 py-2 text-sm shadow-lg",
        "bg-[rgb(var(--card-rgb))] border-[rgb(var(--line-rgb))]",
        "transition-all duration-200",
        "will-change-transform will-change-opacity",
        show ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3",
        t.variant === "success" && "border-[rgb(var(--primary-rgb))]/60",
        t.variant === "error" && "border-[rgb(var(--danger-rgb,220_38_38))]/60"
      )}
      role="status"
      aria-live="polite"
    >
      {t.title && <div className="font-semibold mb-0.5">{t.title}</div>}
      {t.description && <div className="opacity-80">{t.description}</div>}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setItems((arr) => [...arr, { id, ...t }]);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((arr) => arr.filter((x) => x.id !== id));
  }, []);

  const ctx = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={ctx}>
      {children}

      {/* Contenedor top-right debajo del navbar (h-16 / h-20) */}
      <div className="fixed top-16 md:top-20 right-4 z-[60] space-y-2 flex flex-col items-end pointer-events-none">
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
