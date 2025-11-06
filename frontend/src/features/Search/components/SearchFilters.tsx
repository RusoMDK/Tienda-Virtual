// src/Search/components/SearchFilters.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Star, X } from "lucide-react";

type FilterProfile =
  | "grocery"
  | "electronics"
  | "vehicles"
  | "fashion"
  | "general";

type SearchFiltersProps = {
  ratingFilter: string;
  conditionFilter: string;
  minPriceParam: string;
  maxPriceParam: string;
  colorParam: string;
  homeDeliveryParam: string;
  minWarrantyParam: string;

  showConditionFilter: boolean;
  priceBuckets: Array<{ min?: number; max?: number }>;
  filterProfile: FilterProfile;

  // Colores disponibles en el resultado actual (para las bolitas)
  availableColors?: string[];

  onUpdateParams: (next: Record<string, string | null | undefined>) => void;
};

const SLIDER_STEP = 1;

function normalizeColorKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

const COLOR_HEX: Record<string, string> = {
  negro: "#111827",
  black: "#111827",
  blanco: "#f9fafb",
  white: "#f9fafb",
  rojo: "#ef4444",
  red: "#ef4444",
  azul: "#3b82f6",
  blue: "#3b82f6",
  verde: "#22c55e",
  green: "#22c55e",
  amarillo: "#eab308",
  yellow: "#eab308",
  gris: "#6b7280",
  gray: "#6b7280",
  grisoscuro: "#374151",
  naranja: "#f97316",
  orange: "#f97316",
  rosa: "#ec4899",
  pink: "#ec4899",
  morado: "#8b5cf6",
  purple: "#8b5cf6",
  dorado: "#eab308",
  gold: "#eab308",
  plateado: "#9ca3af",
  silver: "#9ca3af",
  marron: "#92400e",
  cafe: "#92400e",
  brown: "#92400e",
};

export default function SearchFilters(props: SearchFiltersProps) {
  const {
    ratingFilter,
    conditionFilter,
    minPriceParam,
    maxPriceParam,
    colorParam,
    homeDeliveryParam,
    minWarrantyParam,
    showConditionFilter,
    priceBuckets,
    filterProfile,
    availableColors = [],
    onUpdateParams,
  } = props;

  // ─────────────────────────────
  // Estado local
  // ─────────────────────────────
  const [priceMinLocal, setPriceMinLocal] = useState(minPriceParam);
  const [priceMaxLocal, setPriceMaxLocal] = useState(maxPriceParam);
  const [warrantyMinLocal, setWarrantyMinLocal] =
    useState<string>(minWarrantyParam);
  const [colorLocal, setColorLocal] = useState<string>(colorParam);

  const currentMinPrice = minPriceParam ? Number(minPriceParam) : null;
  const currentMaxPrice = maxPriceParam ? Number(maxPriceParam) : null;

  // Slider refs / estado de drag
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeHandle, setActiveHandle] = useState<"min" | "max" | null>(null);

  // ─────────────────────────────
  // Rango del slider
  // ─────────────────────────────
  const sliderMinLimit = 0;

  const sliderMaxLimit = useMemo(() => {
    let max = 0;

    for (const b of priceBuckets) {
      if (typeof b.max === "number") max = Math.max(max, b.max);
      if (typeof b.min === "number") max = Math.max(max, b.min);
    }

    if (currentMaxPrice != null) {
      max = Math.max(max, currentMaxPrice);
    }
    if (currentMinPrice != null) {
      max = Math.max(max, currentMinPrice);
    }

    if (max <= 0) max = 1000;

    if (max <= 200) max += 50;
    else if (max <= 500) max += 100;
    else if (max <= 1000) max += 200;
    else max += 500;

    return Math.ceil(max);
  }, [priceBuckets, currentMinPrice, currentMaxPrice]);

  const [sliderMinValue, setSliderMinValue] = useState<number>(sliderMinLimit);
  const [sliderMaxValue, setSliderMaxValue] = useState<number>(sliderMaxLimit);

  const rangeSpan = sliderMaxLimit - sliderMinLimit || 1;
  const percentMin = ((sliderMinValue - sliderMinLimit) / rangeSpan) * 100;
  const percentMax = ((sliderMaxValue - sliderMinLimit) / rangeSpan) * 100;

  // Sync props → estado local (inputs)
  useEffect(() => {
    setPriceMinLocal(minPriceParam);
    setPriceMaxLocal(maxPriceParam);
  }, [minPriceParam, maxPriceParam]);

  useEffect(() => {
    setWarrantyMinLocal(minWarrantyParam);
  }, [minWarrantyParam]);

  useEffect(() => {
    setColorLocal(colorParam);
  }, [colorParam]);

  // Sync filters → slider
  useEffect(() => {
    let min = currentMinPrice != null ? currentMinPrice : sliderMinLimit;
    let max = currentMaxPrice != null ? currentMaxPrice : sliderMaxLimit;

    if (min < sliderMinLimit) min = sliderMinLimit;
    if (max > sliderMaxLimit) max = sliderMaxLimit;
    if (max <= min) max = Math.min(sliderMaxLimit, min + SLIDER_STEP);

    setSliderMinValue(min);
    setSliderMaxValue(max);
  }, [currentMinPrice, currentMaxPrice, sliderMinLimit, sliderMaxLimit]);

  // Drag de handles (ambos se pueden mover libremente dentro del rango)
  useEffect(() => {
    if (!activeHandle) return;

    function getClientX(e: MouseEvent | TouchEvent): number | null {
      if ("touches" in e) {
        if (e.touches.length > 0) return e.touches[0].clientX;
        if (e.changedTouches.length > 0) return e.changedTouches[0].clientX;
        return null;
      }
      return (e as MouseEvent).clientX;
    }

    function handleMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!trackRef.current) return;
      const x = getClientX(e);
      if (x == null) return;

      const rect = trackRef.current.getBoundingClientRect();
      if (!rect.width) return;

      let ratio = (x - rect.left) / rect.width;
      ratio = Math.min(1, Math.max(0, ratio));
      const rawValue =
        sliderMinLimit + ratio * (sliderMaxLimit - sliderMinLimit);
      const value = Math.round(rawValue / SLIDER_STEP) * SLIDER_STEP;

      if (activeHandle === "min") {
        const safe = Math.min(
          Math.max(value, sliderMinLimit),
          sliderMaxValue - SLIDER_STEP
        );
        setSliderMinValue(safe);
        setPriceMinLocal(String(safe));
      } else {
        const safe = Math.max(
          Math.min(value, sliderMaxLimit),
          sliderMinValue + SLIDER_STEP
        );
        setSliderMaxValue(safe);
        setPriceMaxLocal(String(safe));
      }
    }

    function handleUp() {
      setActiveHandle(null);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [
    activeHandle,
    sliderMinLimit,
    sliderMaxLimit,
    sliderMinValue,
    sliderMaxValue,
  ]);

  // ─────────────────────────────
  // UX según perfil
  // ─────────────────────────────
  const profile: FilterProfile = filterProfile || "general";

  const showColorFilter = profile !== "grocery";
  const showWarrantyFilter =
    profile === "electronics" ||
    profile === "vehicles" ||
    profile === "general";
  const showDeliveryFilter = true;

  const ratingSelected = ratingFilter ? Number(ratingFilter) : null;
  const homeDeliveryChecked = homeDeliveryParam === "true";

  // Colores disponibles → bolitas
  const colorOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; hex: string }>();

    for (const raw of availableColors) {
      const label = (raw || "").trim();
      if (!label) continue;
      const key = normalizeColorKey(label);
      if (map.has(key)) continue;
      const hex = COLOR_HEX[key] ?? "#e5e7eb";
      map.set(key, { key, label, hex });
    }

    return Array.from(map.values());
  }, [availableColors]);

  const hasColorSwatches = colorOptions.length > 0;

  // ─────────────────────────────
  // Filtros activos
  // ─────────────────────────────
  const hasPriceFilter = !!(minPriceParam || maxPriceParam);
  const hasRatingFilter = !!ratingFilter;
  const hasConditionFilter = !!conditionFilter;
  const hasColorFilter = !!colorParam;
  const hasDeliveryFilter = homeDeliveryParam === "true";
  const hasWarrantyFilter = !!minWarrantyParam;

  const hasAnyFilter =
    hasPriceFilter ||
    hasRatingFilter ||
    hasConditionFilter ||
    hasColorFilter ||
    hasDeliveryFilter ||
    hasWarrantyFilter;

  function formatBucketLabel(b: { min?: number; max?: number }) {
    const nf = (n: number) => n.toLocaleString("es-ES");
    if (b.min != null && b.max != null) {
      return `${nf(b.min)} a ${nf(b.max)}`;
    }
    if (b.min != null) {
      return `Desde ${nf(b.min)}`;
    }
    if (b.max != null) {
      return `Hasta ${nf(b.max)}`;
    }
    return "";
  }

  function formatActivePriceLabel() {
    if (!hasPriceFilter) return "";
    const nf = (n: string) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return n;
      return num.toLocaleString("es-ES");
    };
    if (minPriceParam && maxPriceParam) {
      return `${nf(minPriceParam)} – ${nf(maxPriceParam)}`;
    }
    if (minPriceParam) return `Desde ${nf(minPriceParam)}`;
    if (maxPriceParam) return `Hasta ${nf(maxPriceParam)}`;
    return "";
  }

  function labelCondition(value: string) {
    switch (value) {
      case "NEW":
        return "Nuevo";
      case "USED":
        return "Usado";
      case "REFURBISHED":
        return "Reacondicionado";
      default:
        return value;
    }
  }

  function handleClearAll() {
    onUpdateParams({
      rating: null,
      condition: null,
      minPrice: null,
      maxPrice: null,
      color: null,
      homeDelivery: null,
      minWarrantyMonths: null,
    });
  }

  // Handlers mínimos (para inputs numéricos)
  function handleSliderMinChange(value: number) {
    const safe = Math.min(
      Math.max(value, sliderMinLimit),
      sliderMaxValue - SLIDER_STEP
    );
    setSliderMinValue(safe);
    setPriceMinLocal(String(safe));
  }

  function handleSliderMaxChange(value: number) {
    const safe = Math.max(
      Math.min(value, sliderMaxLimit),
      sliderMinValue + SLIDER_STEP
    );
    setSliderMaxValue(safe);
    setPriceMaxLocal(String(safe));
  }

  // Si max está pegado al límite → "y más" (sin maxPrice)
  function applyPriceFilterFromSlider() {
    const minStr = String(sliderMinValue);
    const maxStr =
      sliderMaxValue >= sliderMaxLimit ? null : String(sliderMaxValue);

    onUpdateParams({
      minPrice: minStr,
      maxPrice: maxStr,
    });
  }

  // ─────────────────────────────
  // Render
  // ─────────────────────────────
  return (
    <aside className="space-y-6 text-sm max-w-xs w-full md:w-60">
      {/* Header filtros */}
      <div className="pb-3 border-b border-[rgb(var(--border-rgb)/0.6)]">
        <h1 className="text-[15px] font-semibold mb-1.5">Filtrar resultados</h1>
        <p className="text-[11px] text-[rgb(var(--fg-rgb)/0.7)]">
          Ajusta los resultados para encontrar justo lo que necesitas.
        </p>
      </div>

      {/* Filtros activos */}
      {hasAnyFilter && (
        <section
          aria-label="Filtros activos"
          className="
            rounded-xl border border-[rgb(var(--border-rgb))]
            bg-[rgb(var(--card-2-rgb))]
            px-3 py-2.5 space-y-2
          "
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide">
              Filtros activos
            </h2>
            <button
              type="button"
              onClick={handleClearAll}
              className="
                text-[11px] font-medium
                text-[rgb(var(--primary-rgb))]
                hover:underline underline-offset-2
              "
            >
              Limpiar todo
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-1">
            {hasRatingFilter && (
              <button
                type="button"
                onClick={() => onUpdateParams({ rating: null })}
                className="
                  inline-flex items-center gap-1
                  rounded-full border border-[rgb(var(--border-rgb))]
                  bg-[rgb(var(--bg-rgb))]
                  px-2.5 py-0.5 text-[11px]
                  hover:border-[rgb(var(--primary-rgb))]
                  transition-colors
                "
              >
                <span>≥ {ratingFilter}★</span>
                <X size={11} className="opacity-70" />
              </button>
            )}

            {hasPriceFilter && (
              <button
                type="button"
                onClick={() =>
                  onUpdateParams({ minPrice: null, maxPrice: null })
                }
                className="
                  inline-flex items-center gap-1
                  rounded-full border border-[rgb(var(--border-rgb))]
                  bg-[rgb(var(--bg-rgb))]
                  px-2.5 py-0.5 text-[11px]
                  hover:border-[rgb(var(--primary-rgb))]
                  transition-colors
                "
              >
                <span>Precio: {formatActivePriceLabel()}</span>
                <X size={11} className="opacity-70" />
              </button>
            )}

            {hasConditionFilter && (
              <button
                type="button"
                onClick={() => onUpdateParams({ condition: null })}
                className="
                  inline-flex items-center gap-1
                  rounded-full border border-[rgb(var(--border-rgb))]
                  bg-[rgb(var(--bg-rgb))]
                  px-2.5 py-0.5 text-[11px]
                  hover:border-[rgb(var(--primary-rgb))]
                  transition-colors
                "
              >
                <span>Condición: {labelCondition(conditionFilter)}</span>
                <X size={11} className="opacity-70" />
              </button>
            )}

            {hasColorFilter && profile !== "grocery" && (
              <button
                type="button"
                onClick={() => onUpdateParams({ color: null })}
                className="
                  inline-flex items-center gap-1
                  rounded-full border border-[rgb(var(--border-rgb))]
                  bg-[rgb(var(--bg-rgb))]
                  px-2.5 py-0.5 text-[11px]
                  hover:border-[rgb(var(--primary-rgb))]
                  transition-colors
                "
              >
                <span>Color: {colorParam}</span>
                <X size={11} className="opacity-70" />
              </button>
            )}

            {hasDeliveryFilter && (
              <button
                type="button"
                onClick={() => onUpdateParams({ homeDelivery: null })}
                className="
                  inline-flex items-center gap-1
                  rounded-full border border-[rgb(var(--border-rgb))]
                  bg-[rgb(var(--bg-rgb))]
                  px-2.5 py-0.5 text-[11px]
                  hover:border-[rgb(var(--primary-rgb))]
                  transition-colors
                "
              >
                <span>Solo envío a domicilio</span>
                <X size={11} className="opacity-70" />
              </button>
            )}

            {hasWarrantyFilter && showWarrantyFilter && (
              <button
                type="button"
                onClick={() => onUpdateParams({ minWarrantyMonths: null })}
                className="
                  inline-flex items-center gap-1
                  rounded-full border border-[rgb(var(--border-rgb))]
                  bg-[rgb(var(--bg-rgb))]
                  px-2.5 py-0.5 text-[11px]
                  hover:border-[rgb(var(--primary-rgb))]
                  transition-colors
                "
              >
                <span>Garantía ≥ {minWarrantyParam} meses</span>
                <X size={11} className="opacity-70" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* Reseñas */}
      <section
        aria-label="Filtrar por reseñas"
        className="border-b border-[rgb(var(--border-rgb)/0.4)] pb-4"
      >
        <h2 className="font-semibold mb-2 text-[13px]">Reseñas de clientes</h2>
        <div className="space-y-1.5">
          {[4, 3, 2].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() =>
                onUpdateParams({
                  rating: ratingSelected === r ? null : String(r),
                })
              }
              className={`
                flex items-center gap-1.5
                hover:underline underline-offset-2
                ${
                  ratingSelected === r
                    ? "font-semibold text-[rgb(var(--primary-rgb))]"
                    : ""
                }
              `}
            >
              <span className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={
                      i < r
                        ? "fill-current text-[rgb(var(--accent-rgb))]"
                        : "text-[rgb(var(--fg-rgb)/0.4)]"
                    }
                  />
                ))}
              </span>
              <span>{r} estrellas o más</span>
            </button>
          ))}
        </div>
      </section>

      {/* Precio */}
      <section
        aria-label="Filtrar por precio"
        className="
          rounded-xl border border-[rgb(var(--border-rgb))]
          bg-[rgb(var(--card-2-rgb))]
          px-3 py-3
        "
      >
        <h2 className="font-semibold mb-2 text-[13px]">Precio</h2>

        {/* Slider */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-[rgb(var(--fg-rgb)/0.8)]">
              Rango:{" "}
              <strong>
                {sliderMinValue.toLocaleString("es-ES")} –{" "}
                {sliderMaxValue.toLocaleString("es-ES")}
              </strong>
              {sliderMaxValue >= sliderMaxLimit && " y más"}
            </span>
            <button
              type="button"
              onClick={applyPriceFilterFromSlider}
              className="
                px-2 py-0.5 text-[11px] rounded-md
                bg-[rgb(var(--primary-rgb))]
                text-[rgb(var(--bg-rgb))]
                hover:bg-[rgb(var(--primary-rgb)/0.9)]
                transition-colors
              "
            >
              Aplicar
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div
              ref={trackRef}
              className="relative h-7 flex items-center select-none touch-none"
            >
              {/* Track base */}
              <div className="absolute left-1 right-1 h-[3px] rounded-full bg-[rgb(var(--border-rgb)/0.7)]" />
              {/* Track seleccionado */}
              <div
                className="absolute h-[3px] rounded-full bg-[rgb(var(--primary-rgb))] transition-all"
                style={{
                  left: `${percentMin}%`,
                  right: `${100 - percentMax}%`,
                }}
              />

              {/* Handle mínimo */}
              <button
                type="button"
                aria-label="Precio mínimo"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setActiveHandle("min");
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setActiveHandle("min");
                }}
                className={`
                  absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                  w-4 h-4 rounded-full
                  bg-[rgb(var(--primary-rgb))]
                  border border-[rgb(var(--bg-rgb))]
                  shadow-sm
                  transition-transform shadow
                  ${
                    activeHandle === "min"
                      ? "ring-2 ring-[rgb(var(--primary-rgb)/0.45)] scale-105"
                      : "hover:scale-105"
                  }
                `}
                style={{
                  left: `${percentMin}%`,
                }}
              />

              {/* Handle máximo */}
              <button
                type="button"
                aria-label="Precio máximo"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setActiveHandle("max");
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setActiveHandle("max");
                }}
                className={`
                  absolute top-1/2 -translate-y-1/2 -translate-x-1/2
                  w-4 h-4 rounded-full
                  bg-[rgb(var(--primary-rgb))]
                  border border-[rgb(var(--bg-rgb))]
                  shadow-sm
                  transition-transform shadow
                  ${
                    activeHandle === "max"
                      ? "ring-2 ring-[rgb(var(--primary-rgb)/0.45)] scale-105"
                      : "hover:scale-105"
                  }
                `}
                style={{
                  left: `${percentMax}%`,
                }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-[rgb(var(--fg-rgb)/0.6)]">
              <span>{sliderMinLimit.toLocaleString("es-ES")}</span>
              <span>{sliderMaxLimit.toLocaleString("es-ES")}+</span>
            </div>
          </div>
        </div>

        {/* Inputs de texto (responsive) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const minNum = priceMinLocal ? Number(priceMinLocal) : null;
            const maxNum = priceMaxLocal ? Number(priceMaxLocal) : null;

            if (minNum != null && Number.isFinite(minNum)) {
              handleSliderMinChange(minNum);
            }
            if (maxNum != null && Number.isFinite(maxNum)) {
              if (maxNum >= sliderMaxLimit) {
                setSliderMaxValue(sliderMaxLimit);
              } else {
                handleSliderMaxChange(maxNum);
              }
            }

            const minStr = priceMinLocal || null;
            let maxStr = priceMaxLocal || null;

            if (
              maxNum != null &&
              Number.isFinite(maxNum) &&
              maxNum >= sliderMaxLimit
            ) {
              maxStr = null; // y más
            }

            onUpdateParams({
              minPrice: minStr,
              maxPrice: maxStr,
            });
          }}
          className="flex flex-wrap items-center gap-1.5 mb-2"
        >
          <input
            type="number"
            min={0}
            value={priceMinLocal}
            onChange={(e) => setPriceMinLocal(e.target.value)}
            placeholder="Mín"
            className="
              w-20 px-1.5 py-1
              border border-[rgb(var(--border-rgb))]
              rounded-md bg-[rgb(var(--bg-rgb))]
              text-xs
            "
          />
          <span className="text-xs">–</span>
          <input
            type="number"
            min={0}
            value={priceMaxLocal}
            onChange={(e) => setPriceMaxLocal(e.target.value)}
            placeholder="Máx"
            className="
              w-20 px-1.5 py-1
              border border-[rgb(var(--border-rgb))]
              rounded-md bg-[rgb(var(--bg-rgb))]
              text-xs
            "
          />
          <button
            type="submit"
            className="
              px-2 py-1 text-xs rounded-md
              bg-[rgb(var(--primary-rgb))]
              text-[rgb(var(--bg-rgb))]
              hover:bg-[rgb(var(--primary-rgb)/0.9)]
              transition-colors
            "
          >
            Ir
          </button>
        </form>

        {/* Rangos rápidos */}
        {priceBuckets.length > 0 && (
          <div className="space-y-1 text-xs mt-1">
            {priceBuckets.map((b, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  onUpdateParams({
                    minPrice: b.min != null ? String(Math.max(b.min, 0)) : null,
                    maxPrice: b.max != null ? String(Math.max(b.max, 0)) : null,
                  })
                }
                className="block hover:underline underline-offset-2 text-left"
              >
                {formatBucketLabel(b)}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Condición */}
      {showConditionFilter && profile !== "grocery" && (
        <section aria-label="Filtrar por condición" className="space-y-1">
          <h2 className="font-semibold mb-2 text-[13px]">Condición</h2>
          <div className="space-y-1 text-sm">
            {[
              { value: "NEW", label: "Nuevo" },
              { value: "USED", label: "Usado" },
              { value: "REFURBISHED", label: "Reacondicionado" },
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="condition"
                  value={opt.value}
                  checked={conditionFilter === opt.value}
                  onChange={() =>
                    onUpdateParams({
                      condition:
                        conditionFilter === opt.value ? null : opt.value,
                    })
                  }
                  className="accent-[rgb(var(--primary-rgb))]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Color */}
      {showColorFilter && (
        <section aria-label="Filtrar por color" className="space-y-1">
          <h2 className="font-semibold mb-2 text-[13px]">Color principal</h2>

          {hasColorSwatches ? (
            <>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((c) => {
                  const selected =
                    !!colorParam && normalizeColorKey(colorParam) === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() =>
                        onUpdateParams({
                          color: selected ? null : c.label,
                        })
                      }
                      aria-label={c.label}
                      className={`
                        group relative inline-flex items-center justify-center
                        w-7 h-7 rounded-full border
                        ${
                          selected
                            ? "border-[rgb(var(--primary-rgb))] ring-1 ring-[rgb(var(--primary-rgb)/0.45)]"
                            : "border-[rgb(var(--border-rgb))]"
                        }
                        bg-[rgb(var(--bg-rgb))]
                        transition-transform
                        hover:scale-105
                      `}
                    >
                      <span
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-[11px] text-[rgb(var(--fg-rgb)/0.6)]">
                {colorOptions.map((c) => c.label).join(" · ")}
              </div>
            </>
          ) : (
            // Fallback: input de texto si aún no tienes colores agregados desde el backend
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateParams({
                  color: colorLocal || null,
                });
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={colorLocal}
                onChange={(e) => setColorLocal(e.target.value)}
                placeholder="Ej: rojo, negro…"
                className="
                  flex-1 px-2 py-1
                  border border-[rgb(var(--border-rgb))]
                  rounded-md bg-[rgb(var(--bg-rgb))]
                  text-xs
                "
              />
              <button
                type="submit"
                className="
                  px-2 py-1 text-xs rounded-md
                  bg-[rgb(var(--primary-rgb))]
                  text-[rgb(var(--bg-rgb))]
                  hover:bg-[rgb(var(--primary-rgb)/0.9)]
                  transition-colors
                "
              >
                Aplicar
              </button>
            </form>
          )}
        </section>
      )}

      {/* Entrega */}
      {showDeliveryFilter && (
        <section aria-label="Filtrar por entrega" className="space-y-1">
          <h2 className="font-semibold mb-2 text-[13px]">Entrega</h2>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={homeDeliveryChecked}
              onChange={(e) =>
                onUpdateParams({
                  homeDelivery: e.target.checked ? "true" : null,
                })
              }
              className="accent-[rgb(var(--primary-rgb))]"
            />
            <span>Solo con envío a domicilio</span>
          </label>
        </section>
      )}

      {/* Garantía */}
      {showWarrantyFilter && (
        <section aria-label="Filtrar por garantía" className="space-y-1">
          <h2 className="font-semibold mb-2 text-[13px]">Garantía mínima</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateParams({
                minWarrantyMonths: warrantyMinLocal || null,
              });
            }}
            className="flex flex-wrap items-center gap-1.5"
          >
            <input
              type="number"
              min={0}
              value={warrantyMinLocal}
              onChange={(e) => setWarrantyMinLocal(e.target.value)}
              placeholder="Meses"
              className="
                w-20 px-1.5 py-1
                border border-[rgb(var(--border-rgb))]
                rounded-md bg-[rgb(var(--bg-rgb))]
                text-xs
              "
            />
            <button
              type="submit"
              className="
                px-2 py-1 text-xs rounded-md
                bg-[rgb(var(--primary-rgb))]
                text-[rgb(var(--bg-rgb))]
                hover:bg-[rgb(var(--primary-rgb)/0.9)]
                transition-colors
              "
            >
              Filtrar
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdateParams({ minWarrantyMonths: String(m) })}
                className={`
                  px-2 py-0.5 rounded-full border
                  ${
                    minWarrantyParam === String(m)
                      ? "border-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-rgb))]"
                      : "border-[rgb(var(--border-rgb))]"
                  }
                `}
              >
                ≥ {m} meses
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
