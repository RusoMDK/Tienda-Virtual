// src/features/categories/components/SubcategoryCard.tsx
import React, { MouseEvent } from "react";
import { cn } from "@/utils/cn";

type Props = {
  name: string;
  slug: string;
  imageUrl?: string | null;
  onClick?: (slug: string) => void;
  /** Controla el ANCHO de la tarjeta: pasa ambas w/min-w en una sola clase. */
  className?: string;
};

const PLACEHOLDER =
  "https://placehold.co/800x500/png?text=Categor%C3%ADa&font=source-sans-pro";

export default function SubcategoryCard({
  name,
  slug,
  imageUrl,
  onClick,
  className,
}: Props) {
  const src = imageUrl || PLACEHOLDER;

  function handle(e: MouseEvent) {
    e.preventDefault();
    onClick?.(slug);
  }

  return (
    <button
      onClick={handle}
      title={name}
      className={cn(
        "group relative shrink-0 snap-start overflow-hidden rounded-2xl border bg-[rgb(var(--card-rgb))] text-left",
        "hover:bg-[rgb(var(--card-2-rgb))] transition-colors",
        "w-[clamp(140px,14vw,180px)] min-w-[clamp(140px,14vw,180px)]",
        className
      )}
    >
      <div className="aspect-[16/10] w-full overflow-hidden">
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
          }}
        />
      </div>
      <div className="p-2.5">
        <div className="font-medium text-[13px] leading-tight">{name}</div>
        <div className="text-[11px] text-[rgb(var(--fg-rgb)/0.7)]">
          Ver productos
        </div>
      </div>
    </button>
  );
}
