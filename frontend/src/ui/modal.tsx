import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px] opacity-0 animate-[fadeIn_.15s_ease-out_forwards]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "w-full max-w-lg rounded-2xl border border-[rgb(var(--line-rgb))] bg-[rgb(var(--card-rgb))] shadow-2xl",
            "opacity-0 translate-y-2 scale-[0.99] animate-[dialogIn_.16s_ease-out_forwards]",
            wide && "max-w-3xl"
          )}
        >
          {title && (
            <div className="p-4 border-b border-[rgb(var(--line-rgb))] font-semibold">
              {title}
            </div>
          )}
          <div className="p-4">{children}</div>
          {footer && (
            <div className="p-4 border-t border-[rgb(var(--line-rgb))]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Añade estas keyframes en tu CSS global una vez:
@keyframes fadeIn { to { opacity: 1; } }
@keyframes dialogIn { to { opacity: 1; transform: translateY(0) scale(1); } }
*/
