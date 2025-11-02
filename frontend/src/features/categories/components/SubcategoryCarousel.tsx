import { useMemo } from "react";
import Carousel from "@/components/Carousel";
import { cn } from "@/utils/cn";

type Item = {
  slug: string;
  name: string;
  imageUrl?: string | null;
  count?: number;
};

const PLACEHOLDER =
  "https://placehold.co/800x800/png?text=Cat&font=source-sans-pro";

export default function SubcategoryCarousel({
  items,
  title = "Explorar categorías",
  subtitle,
  onPick,
  selectedSlug,
  /** control de ancho: "full" (default, igual que el catálogo),
   *  "compact" (~1200px) o "tight" (~920px) */
  width = "full",
}: {
  items: Item[];
  title?: string;
  subtitle?: string;
  onPick: (slug: string) => void;
  selectedSlug?: string;
  width?: "full" | "compact" | "tight";
}) {
  const cards = useMemo(
    () => items.map((it) => ({ ...it, image: it.imageUrl || PLACEHOLDER })),
    [items]
  );

  if (!cards.length) return null;

  const wrapperClass =
    width === "full"
      ? "" // ocupa todo el ancho de .container
      : width === "compact"
      ? "mx-auto max-w-[min(100%,1200px)]"
      : "mx-auto max-w-[min(100%,920px)]";

  return (
    <section className="py-6 section-elevated">
      <div className="container">
        <div className={wrapperClass}>
          <header className="mb-4 text-center">
            <h3 className="text-lg md:text-xl font-semibold">{title}</h3>
            {subtitle && (
              <p className="text-sm text-[rgb(var(--fg-rgb)/0.7)] mt-1">
                {subtitle}
              </p>
            )}
          </header>

          {/* Carrusel: avatar circular + etiqueta debajo */}
          <Carousel
            ariaLabel="Subcategorías"
            centerMode={false} // 👈 ARRANCA ALINEADO A LA IZQUIERDA
            className="relative -mx-1 sm:-mx-2 px-1 sm:px-2"
          >
            {cards.map((c) => (
              <div
                key={c.slug}
                data-carousel-item
                className={cn(
                  "snap-start shrink-0", // 👈 snap al inicio, no al centro
                  "w-[150px] sm:w-[168px] md:w-[184px] flex flex-col items-center"
                )}
              >
                <AvatarCircle
                  name={c.name}
                  image={c.image}
                  active={selectedSlug ? c.slug === selectedSlug : false}
                  onClick={() => onPick(c.slug)}
                  isAll={/^(todo|all)\b/i.test(c.name)}
                />
                <div className="mt-2 text-center">
                  <div className="text-[12px] sm:text-sm font-medium leading-tight line-clamp-2">
                    {c.name}
                  </div>
                  {/* Si quieres mostrar cantidad:
                  {typeof c.count === "number" && (
                    <div className="text-[11px] text-[rgb(var(--fg-rgb)/0.6)]">
                      {c.count} productos
                    </div>
                  )} */}
                </div>
              </div>
            ))}
          </Carousel>
        </div>
      </div>
    </section>
  );
}

function AvatarCircle({
  name,
  image,
  active,
  onClick,
  isAll,
}: {
  name: string;
  image: string;
  active?: boolean;
  onClick: () => void;
  isAll?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={name}
      aria-label={name}
      aria-pressed={active}
      className={cn(
        "group relative outline-none rounded-full",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      )}
    >
      {/* Glow suave */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-2 rounded-full blur-md",
          active
            ? "opacity-70"
            : "opacity-0 group-hover:opacity-60 transition-opacity",
          "bg-[radial-gradient(80px_80px_at_50%_50%,rgba(16,185,129,0.28),transparent_70%)]"
        )}
      />

      {/* Borde degradado */}
      <span
        className={cn(
          "relative inline-block p-[2px] rounded-full",
          "bg-[conic-gradient(at_30%_30%,rgb(var(--primary-rgb)/.85),rgb(var(--accent-rgb)/.75),rgb(var(--primary-rgb)/.85))]"
        )}
      >
        {/* Círculo interior con tamaños explícitos */}
        <span
          className={cn(
            "block rounded-full overflow-hidden bg-[rgb(var(--card-rgb))]",
            "h-[112px] w-[112px] sm:h-[128px] sm:w-[128px] md:h-[144px] md:w-[144px]",
            "shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5"
          )}
        >
          <img
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover rounded-full transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
            }}
          />
          {/* Shine */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 rounded-full",
              "bg-[radial-gradient(120px_60px_at_-10%_50%,rgba(255,255,255,0.22)_0%,transparent_60%)]",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "translate-x-[-20%] group-hover:translate-x-[60%] rotate-[10deg]",
              "duration-700 ease-out"
            )}
          />
          {isAll && (
            <span className="absolute left-2 top-2 rounded-full px-2 py-[2px] text-[10px] font-semibold bg-[rgba(0,0,0,0.35)] text-white backdrop-blur-sm">
              Todo
            </span>
          )}
        </span>
      </span>

      {active && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-[-3px] rounded-full",
            "ring-2 ring-offset-2 ring-offset-[rgb(var(--bg-rgb))] ring-[rgb(var(--primary-rgb))]"
          )}
        />
      )}
    </button>
  );
}
