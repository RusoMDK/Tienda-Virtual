import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Container from "@/layout/Container";
import {
  Card,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Skeleton,
  Input,
} from "@/ui";
import { useToast } from "@/ui";
import { useCartStore } from "@/features/cart/store";
import {
  getProductWithRelated,
  type ProductDTO,
} from "@/features/products/api";
import { Price } from "@/features/currency/Price";
import { ProductCardMinimal } from "@/features/products/components/ProductCardMinimal";

// ───────────────────────── helpers imágenes
function normalizeImageEntry(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") return x;
  if (typeof x === "object" && typeof x.url === "string") return x.url;
  return null;
}
function collectProductImages(p: ProductDTO): string[] {
  const candidates: any[] =
    (p as any).images ??
    (p as any).photos ??
    (p as any).gallery ??
    (p as any).media ??
    [];
  const arr = Array.isArray(candidates)
    ? (candidates.map(normalizeImageEntry).filter(Boolean) as string[])
    : [];
  return arr.length > 0 ? arr : ["https://placehold.co/1200x900?text=Sin+foto"];
}

// ─────────────────────────────────── Galería
function ImageGallery({ name, images }: { name: string; images: string[] }) {
  const [idx, setIdx] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [lightbox, setLightbox] = useState<{ open: boolean; i: number }>({
    open: false,
    i: 0,
  });
  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const current = images[idx] ?? images[0];

  const onMouseMove = (e: React.MouseEvent) => {
    if (!imgWrapRef.current) return;
    const rect = imgWrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x, y });
  };

  const openLightbox = (i: number) => setLightbox({ open: true, i });
  const closeLightbox = () => setLightbox({ open: false, i: 0 });
  const prev = () =>
    setLightbox((s) => ({
      ...s,
      i: (s.i - 1 + images.length) % images.length,
    }));
  const next = () =>
    setLightbox((s) => ({ ...s, i: (s.i + 1) % images.length }));

  useEffect(() => {
    if (!lightbox.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox.open, images.length]);

  return (
    <div className="grid gap-3 md:grid-cols-[86px_1fr]">
      <div className="hidden md:block">
        <div
          role="tablist"
          aria-label="Galería de imágenes"
          className="flex md:flex-col gap-2 max-h-[520px] overflow-auto pr-1"
        >
          {images.map((src, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === idx}
              className={`rounded-xl border overflow-hidden transition outline-none ${
                i === idx
                  ? "border-[var(--primary)]"
                  : "border-[var(--border)] hover:border-[var(--primary)]/40"
              }`}
              onClick={() => setIdx(i)}
            >
              <img
                src={src}
                alt={`${name} vista ${i + 1}`}
                className="w-20 h-20 object-cover"
                loading={i > 2 ? "lazy" : "eager"}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "https://placehold.co/300x300?text=Foto";
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={imgWrapRef}
            className="relative group cursor-zoom-in md:cursor-zoom-in"
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={onMouseMove}
            onClick={() => openLightbox(idx)}
          >
            <img
              src={current}
              alt={name}
              className="w-full h-auto object-cover aspect-[4/3] transition-transform duration-300"
              style={
                zooming
                  ? {
                      transform: "scale(1.25)",
                      transformOrigin: `${origin.x}% ${origin.y}%`,
                    }
                  : undefined
              }
              loading="eager"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "https://placehold.co/1200x900?text=Producto";
              }}
            />
            <div className="absolute bottom-2 right-2 rounded-full bg-black/50 text-white text-[11px] px-2 py-1 pointer-events-none">
              Clic para ampliar
            </div>
          </div>
        </CardContent>

        <div className="md:hidden px-3 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {images.map((src, i) => (
              <button
                key={i}
                className={`shrink-0 rounded-xl border overflow-hidden ${
                  i === idx
                    ? "border-[var(--primary)]"
                    : "border-[var(--border)]"
                }`}
                onClick={() => setIdx(i)}
                aria-label={`Vista ${i + 1}`}
              >
                <img
                  src={src}
                  alt={`${name} vista ${i + 1}`}
                  className="w-16 h-16 object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "https://placehold.co/200x200?text=Foto";
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {lightbox.open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <button
            className="absolute top-4 right-4 rounded-xl border border-white/20 text-white/90 px-3 py-1 text-sm hover:bg-white/10"
            onClick={closeLightbox}
            aria-label="Cerrar"
          >
            Cerrar ✕
          </button>
          <button
            className="absolute left-3 md:left-6 rounded-xl border border-white/20 text-white/90 px-3 py-1 text-sm hover:bg-white/10"
            onClick={prev}
            aria-label="Anterior"
          >
            ←
          </button>
          <img
            src={images[lightbox.i]}
            alt={`${name} grande`}
            className="max-h-[85vh] w-auto object-contain rounded-xl border border-white/10 shadow-2xl"
          />
          <button
            className="absolute right-3 md:right-6 rounded-xl border border-white/20 text-white/90 px-3 py-1 text-sm hover:bg-white/10"
            onClick={next}
            aria-label="Siguiente"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────── Página
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const toast = useToast();

  const add = useCartStore((s) => s.add);
  const [qty, setQty] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["product+related", slug],
    queryFn: async () => {
      if (!slug) throw new Error("Missing slug");
      return getProductWithRelated(slug, { relatedLimit: 6 });
    },
    enabled: !!slug,
    retry: (failureCount, err: any) => {
      if ((err as any)?.code === "NOT_FOUND") return false;
      return failureCount < 2;
    },
  });

  const getCartQty = useCallback((productId?: string) => {
    if (!productId) return 0;
    const it = useCartStore
      .getState()
      .items.find((x) => x.productId === productId);
    return it?.qty ?? 0;
  }, []);

  const currentProductId = data?.product?.id;
  const stock = data?.product?.stock ?? 0;
  const alreadyInCart = getCartQty(currentProductId);
  const remaining = Math.max(0, stock - alreadyInCart);

  useEffect(() => {
    setQty((q) => {
      if (remaining <= 0) return 1;
      const limit = Math.max(1, remaining);
      return Math.max(1, Math.min(q, limit));
    });
  }, [remaining, currentProductId]);

  useEffect(() => {
    if (data?.product?.name) document.title = `${data.product.name} – Tienda`;
  }, [data?.product?.name]);

  const clampQty = useCallback(
    (n: number) => {
      const next = Number.isFinite(n) ? n : 1;
      const limit = Math.max(1, remaining || 1);
      setQty(Math.max(1, Math.min(next, limit)));
    },
    [remaining]
  );

  if (isLoading) {
    return (
      <Container className="py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <Skeleton className="h-[380px] md:h-[520px]" />
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (isError || !data?.product) {
    const msg =
      (error as any)?.code === "NOT_FOUND"
        ? "Producto no encontrado"
        : "No se pudo cargar el producto";
    return (
      <Container className="py-10 text-center space-y-3">
        <h2 className="text-xl font-semibold">{msg}</h2>
        <Button asChild variant="secondary">
          <Link to="/">Volver al catálogo</Link>
        </Button>
      </Container>
    );
  }

  const p = data.product;
  const images = collectProductImages(p);
  const canAdd = p.active && p.stock > 0 && remaining > 0 && qty > 0;

  function onAdd(buyNow: boolean) {
    if (!canAdd) {
      toast({
        title: "Sin stock disponible",
        description: "Ya no quedan unidades para añadir.",
        variant: "error",
      });
      return;
    }
    const before = getCartQty(p.id);
    add(
      {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        maxStock: p.stock,
      },
      qty
    );
    const after = getCartQty(p.id);
    const delta = Math.max(0, after - before);
    const availableBefore = Math.max(0, p.stock - before);

    if (delta <= 0) {
      toast({
        title: "Límite alcanzado",
        description: `Máximo disponible: ${p.stock}.`,
        variant: "error",
      });
      return;
    }
    if (delta < qty) {
      toast({
        title: "Stock limitado",
        description: `Solo quedaban ${availableBefore}, añadimos ${delta}.`,
        variant: "warning",
      });
    } else {
      toast({ title: "Añadido al carrito", variant: "success" });
    }
    if (buyNow) nav("/cart");
  }

  const boxClass = "rounded-2xl bg-[var(--card)] border border-[var(--border)]";
  const qtyWrapClass =
    "flex items-stretch rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-1)]";
  const inputClass =
    "w-16 text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:outline-none";

  return (
    <Container className="py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm opacity-80">
        <Link to="/" className="hover:underline">
          Inicio
        </Link>{" "}
        <span aria-hidden>›</span>{" "}
        <span className="opacity-90 line-clamp-1 align-middle">{p.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ImageGallery name={p.name} images={images} />

        <div className="space-y-4 md:sticky md:top-24 self-start">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              {p.name}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Compartir producto"
              onClick={async () => {
                const url = window.location.href;
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: p.name,
                      text: p.description,
                      url,
                    });
                  } else {
                    await navigator.clipboard.writeText(url);
                    toast({
                      title: "Enlace copiado",
                      description: "Listo para compartir.",
                      variant: "success",
                    });
                  }
                } catch {}
              }}
            >
              Compartir
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold">
              <Price cents={p.price} currency={p.currency || "USD"} />
            </div>
            {!p.active ? (
              <Badge>No disponible</Badge>
            ) : p.stock === 0 ? (
              <Badge>Sin stock</Badge>
            ) : remaining === 0 ? (
              <Badge>Sin unidades disponibles</Badge>
            ) : p.stock <= 3 ? (
              <Badge>Quedan {p.stock}</Badge>
            ) : (
              <Badge>En stock</Badge>
            )}
          </div>

          <p className="opacity-80 leading-relaxed">{p.description}</p>

          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80">Cantidad</span>
            <div className={qtyWrapClass}>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 rounded-none"
                onClick={() => clampQty(qty - 1)}
                disabled={qty <= 1}
                aria-label="Disminuir cantidad"
              >
                –
              </Button>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                className={inputClass}
                value={qty}
                aria-label="Cantidad"
                onChange={(e) => {
                  const raw = e.currentTarget.value.replace(/[^\d]/g, "");
                  clampQty(Number(raw || 1));
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    clampQty(qty + 1);
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    clampQty(qty - 1);
                  }
                  if (e.key === "Enter") {
                    onAdd(true);
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-10 rounded-none"
                onClick={() => clampQty(qty + 1)}
                disabled={remaining <= 0 || qty >= (remaining || 1)}
                aria-label="Aumentar cantidad"
              >
                +
              </Button>
            </div>
            {p.stock > 0 && (
              <span className="text-xs opacity-60" aria-live="polite">
                {remaining > 0
                  ? `Te quedan ${remaining} disponibles`
                  : "Sin unidades disponibles"}
              </span>
            )}
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <Button disabled={!canAdd} onClick={() => onAdd(true)}>
              Comprar ahora
            </Button>
            <Button
              variant="secondary"
              disabled={!canAdd}
              onClick={() => onAdd(false)}
            >
              Añadir al carrito
            </Button>
          </div>

          <Card className={`${boxClass} mt-2`}>
            <CardContent className="space-y-1.5">
              <ul className="text-sm opacity-80 list-disc pl-5 space-y-1">
                <li>Pago seguro con Stripe.</li>
                <li>Envío rápido con tracking.</li>
                <li>Devolución en 30 días.</li>
              </ul>
            </CardContent>
            <CardFooter className="text-xs opacity-60 break-all">
              SKU: {p.id}
            </CardFooter>
          </Card>
        </div>
      </div>

      {data.related?.length ? (
        <section className="mt-10">
          <h3 className="text-lg md:text-xl font-semibold mb-3">
            Más productos que te pueden gustar
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.related.slice(0, 6).map((r: any) => {
              const firstImage =
                (Array.isArray(r.images) && r.images[0]) ||
                r.imageUrl ||
                "https://placehold.co/600x450?text=Sin+foto";

              return (
                <ProductCardMinimal
                  key={r.id}
                  to={`/product/${r.slug}`}
                  name={r.name}
                  priceCents={r.price}
                  currency={r.currency || "USD"}
                  imageUrl={firstImage}
                  variant="compact"
                  aspect="landscape"
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </Container>
  );
}
