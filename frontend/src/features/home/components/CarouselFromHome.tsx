import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/ui";
import type { HomeSection } from "@/features/home/types";

type Slide = {
  id: string | number;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string | null;
};

export default function CarouselFromHome({
  section,
}: {
  section: HomeSection;
}) {
  const cfg: any = section.config ?? {};
  const layout: any = section.layout ?? {};

  const mode: string = cfg.mode || "STATIC";
  const rawSlides: any[] = Array.isArray(cfg.slides) ? cfg.slides : [];
  const isCarousel = mode === "CAROUSEL" && rawSlides.length > 0;

  const baseTitle = section.title;
  const baseSubtitle = section.subtitle;
  const baseCtaLabel = cfg.ctaLabel;
  const baseCtaHref = cfg.ctaHref || "/tienda";

  const fallbackBgUrl: string | null =
    cfg.backgroundImageUrl || cfg.backgroundImage?.url || null;

  const slides: Slide[] = useMemo(() => {
    if (isCarousel) {
      return rawSlides.map((s, index) => ({
        id: s.id ?? index,
        title: s.title || baseTitle,
        subtitle: s.subtitle || baseSubtitle,
        ctaLabel: s.ctaLabel || baseCtaLabel,
        ctaHref: s.ctaHref || baseCtaHref,
        imageUrl: s.imageUrl || fallbackBgUrl,
      }));
    }
    return [
      {
        id: "static",
        title: baseTitle,
        subtitle: baseSubtitle,
        ctaLabel: baseCtaLabel,
        ctaHref: baseCtaHref,
        imageUrl: fallbackBgUrl,
      },
    ];
  }, [
    isCarousel,
    rawSlides,
    baseTitle,
    baseSubtitle,
    baseCtaLabel,
    baseCtaHref,
    fallbackBgUrl,
  ]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isCarousel || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, cfg.intervalMs || 7000);
    return () => window.clearInterval(id);
  }, [isCarousel, slides.length, cfg.intervalMs]);

  const active = slides[index];

  const align: "left" | "center" | "right" =
    layout.align === "center" || layout.align === "right"
      ? layout.align
      : "left";

  const alignCls =
    align === "center"
      ? "items-center text-center"
      : align === "right"
      ? "items-end text-right"
      : "items-start text-left";

  const width: "full-bleed" | "content" =
    layout.width === "content" ? "content" : "full-bleed";

  const overlapNext = !!layout.overlapNext;

  const goToSlide = (nextIndex: number) => {
    if (!isCarousel) return;
    setIndex(nextIndex);
  };

  // ========================
  // HERO FULL-BLEED (tipo Amazon) con fade vertical desde la mitad
  // ========================
  if (width === "full-bleed") {
    return (
      <section className={overlapNext ? "mb-0" : "mb-8"}>
        <div className="relative -mx-2 sm:-mx-4 lg:-mx-8">
          <div className="relative overflow-hidden bg-[rgb(var(--bg-rgb))]">
            <div className="relative h-[320px] sm:h-[380px] md:h-[480px] lg:h-[560px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active?.id}
                  initial={{ opacity: 0, scale: 1.01 }}
                  animate={{ opacity: 1, scale: 1.02 }}
                  exit={{ opacity: 0, scale: 1.01 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute inset-0 overflow-hidden bg-[rgb(var(--bg-rgb))]"
                >
                  {active?.imageUrl && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${active.imageUrl})`,
                        backgroundPosition: "top center",
                        backgroundSize: "cover",
                        // 👇 de 0% a 50% totalmente visible, de 50% a 100% se desvanece
                        WebkitMaskImage:
                          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
                        maskImage:
                          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
                      }}
                    >
                      {/* sombreado lateral para legibilidad del texto */}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/10" />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Contenido (texto + CTA) */}
              <div className="relative z-10 h-full">
                <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center">
                  <div
                    className={[
                      "flex flex-col gap-4 max-w-xl text-white",
                      alignCls,
                    ].join(" ")}
                  >
                    <div className="space-y-2 w-full">
                      {isCarousel && (
                        <p className="inline-flex items-center gap-2 rounded-full bg-black/45 text-[10px] md:text-[11px] px-3 py-1 text-white/80 backdrop-blur-sm border border-white/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Carrusel de inicio
                        </p>
                      )}
                      {active?.title && (
                        <motion.h1
                          key={`title-${active.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight drop-shadow-sm"
                        >
                          {active.title}
                        </motion.h1>
                      )}
                      {active?.subtitle && (
                        <motion.p
                          key={`subtitle-${active.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                          className="text-sm md:text-base text-white/85"
                        >
                          {active.subtitle}
                        </motion.p>
                      )}
                    </div>

                    <div className="w-full max-w-md space-y-2">
                      {active?.ctaLabel && (
                        <Button
                          asChild
                          size="lg"
                          className="w-full md:w-auto inline-flex justify-center shadow-lg shadow-black/25"
                        >
                          <Link to={active.ctaHref || baseCtaHref}>
                            {active.ctaLabel}
                          </Link>
                        </Button>
                      )}

                      {cfg.showSearch && (
                        <div className="relative mt-1 w-full">
                          <input
                            type="search"
                            placeholder="Buscar productos..."
                            className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/60 backdrop-blur-sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Bullets del carrusel */}
                    {isCarousel && slides.length > 1 && (
                      <div className="flex gap-1.5 mt-1">
                        {slides.map((s, idx) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => goToSlide(idx)}
                            className={[
                              "h-1.5 rounded-full transition-all",
                              idx === index
                                ? "w-6 bg-white"
                                : "w-2 bg-white/40 hover:bg-white/70",
                            ].join(" ")}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ========================
  // Hero "content" dentro del container (con el mismo fade mitad → abajo)
  // ========================
  return (
    <section className={overlapNext ? "mb-0" : "mb-8"}>
      <div className="rounded-3xl border border-[rgb(var(--border-rgb))] overflow-hidden bg-gradient-to-r from-[rgb(var(--primary-rgb)/0.12)] to-[rgb(var(--primary-rgb)/0.04)]">
        <div className="grid md:grid-cols-2">
          <div className="p-6 md:p-8 flex flex-col gap-4 justify-center">
            {active?.title && (
              <h1 className="text-2xl md:text-3xl font-bold">{active.title}</h1>
            )}
            {active?.subtitle && (
              <p className="text-sm md:text-base opacity-80">
                {active.subtitle}
              </p>
            )}

            <div className={["flex gap-3 mt-2 w-full", alignCls].join(" ")}>
              <div className="flex flex-col gap-2 w-full max-w-md">
                {active?.ctaLabel && (
                  <Button
                    asChild
                    size="lg"
                    className="w-full md:w-auto inline-flex justify-center"
                  >
                    <Link to={active.ctaHref || baseCtaHref}>
                      {active.ctaLabel}
                    </Link>
                  </Button>
                )}

                {cfg.showSearch && (
                  <div className="relative mt-1">
                    <input
                      type="search"
                      placeholder="Buscar productos..."
                      className="w-full rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-4 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {isCarousel && slides.length > 1 && (
              <div className="flex gap-1.5 mt-2">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToSlide(idx)}
                    className={[
                      "h-1.5 rounded-full transition-all",
                      idx === index
                        ? "w-6 bg-[rgb(var(--primary-rgb))]"
                        : "w-2 bg-[rgb(var(--primary-rgb))/0.4] hover:bg-[rgb(var(--primary-rgb))]",
                    ].join(" ")}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:block relative min-h-[220px] bg-[rgb(var(--bg-rgb))]">
            {active?.imageUrl ? (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${active.imageUrl})`,
                  backgroundPosition: "top center",
                  backgroundSize: "cover",
                  // 👇 igual: visible arriba, desvanecido desde la mitad
                  WebkitMaskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
                  maskImage:
                    "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-40 h-40 rounded-full border border-dashed border-[rgb(var(--primary-rgb))]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
