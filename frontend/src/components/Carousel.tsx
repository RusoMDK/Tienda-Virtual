import React, {
  useEffect,
  useRef,
  useState,
  ReactNode,
  KeyboardEvent,
  useLayoutEffect,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

type Props = {
  children: ReactNode;
  className?: string;
  stepPx?: number;
  ariaLabel?: string;
  centerMode?: boolean;
};

export default function Carousel({
  children,
  className,
  stepPx,
  ariaLabel,
  centerMode = true,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [padX, setPadX] = useState(0);

  const updateEdges = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth - 1;
    setAtStart(el.scrollLeft <= 0);
    setAtEnd(el.scrollLeft >= max);
  };

  const recalcPadding = () => {
    if (!centerMode) return setPadX(0);
    const el = ref.current;
    if (!el) return;

    const first =
      (el.querySelector<HTMLElement>("[data-carousel-item]") as HTMLElement) ||
      (el.firstElementChild as HTMLElement | null);
    if (!first) return setPadX(0);

    const itemWidth = first.offsetWidth;
    const containerWidth = el.clientWidth;
    const px = Math.max(0, Math.round((containerWidth - itemWidth) / 2));
    setPadX(px);
    el.style.setProperty("scroll-padding-left", `${px}px`);
    el.style.setProperty("scroll-padding-right", `${px}px`);
  };

  useLayoutEffect(() => {
    recalcPadding();
  }, [children, centerMode]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateEdges();
    const onScroll = () => updateEdges();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => {
      recalcPadding();
      updateEdges();
    });
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollByDir = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const amount = stepPx ?? Math.floor(el.clientWidth * 0.7);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByDir(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByDir(1);
    }
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    const el = ref.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    }
  };

  // Drag con supresión de click
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false,
      moved = false,
      startX = 0,
      startLeft = 0,
      suppressClick = false;

    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("a,button,[role=button],[data-no-drag]")) return;
      isDown = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.classList.add("cursor-grabbing");
    };
    const move = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) moved = true;
      if (moved) el.scrollLeft = startLeft - dx;
    };
    const up = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove("cursor-grabbing");
      if (moved) {
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 0);
      }
    };
    const clickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("click", clickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("click", clickCapture, true);
    };
  }, []);

  return (
    <div className={cn("relative group z-10", className)}>
      {!atStart && (
        <div className="pointer-events-none absolute left-0 top-0 h-full w-8 sm:w-12 bg-gradient-to-r from-[rgb(var(--bg-rgb))] to-transparent" />
      )}
      {!atEnd && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 sm:w-12 bg-gradient-to-l from-[rgb(var(--bg-rgb))] to-transparent" />
      )}

      <button
        aria-label="Anterior"
        disabled={atStart}
        onClick={() => scrollByDir(-1)}
        className={cn(
          "absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full",
          "backdrop-blur bg-[rgb(var(--card-rgb)/0.7)] border border-[rgb(var(--border-rgb))]",
          "grid place-items-center transition-all shadow-sm",
          "opacity-0 group-hover:opacity-100 focus:opacity-100",
          atStart ? "pointer-events-none" : "hover:scale-105"
        )}
      >
        <ChevronLeft size={18} />
      </button>

      <button
        aria-label="Siguiente"
        disabled={atEnd}
        onClick={() => scrollByDir(1)}
        className={cn(
          "absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full",
          "backdrop-blur bg-[rgb(var(--card-rgb)/0.7)] border border-[rgb(var(--border-rgb))]",
          "grid place-items-center transition-all shadow-sm",
          "opacity-0 group-hover:opacity-100 focus:opacity-100",
          atEnd ? "pointer-events-none" : "hover:scale-105"
        )}
      >
        <ChevronRight size={18} />
      </button>

      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        className={cn(
          "no-scrollbar overflow-x-auto scroll-smooth",
          "snap-x snap-mandatory overscroll-x-contain",
          "flex items-center gap-4 px-2 py-2", // 👈 centrado vertical
          "min-h-[136px] sm:min-h-[156px] md:min-h-[176px]", // 👈 reserva de altura
          "cursor-grab active:cursor-grabbing"
        )}
        style={{
          paddingLeft: padX || undefined,
          paddingRight: padX || undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
