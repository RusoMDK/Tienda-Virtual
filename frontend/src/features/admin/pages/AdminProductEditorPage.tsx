import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useToast } from "@/ui";
import { Button, Input, Skeleton } from "@/ui";
import ImageUploader, {
  type UImage,
} from "@/features/admin/components/ImageUploader";
import {
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminListCategories,
  type AdminProductDTO,
} from "@/features/admin/api";

/* Helpers dinero/validación */
const strToCents = (s: string) => {
  const n = Number(
    String(s || "")
      .replace(/[^\d.,-]/g, "")
      .replace(",", ".")
  );
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
};

const FormSchema = z.object({
  name: z.string().min(1, "Requerido").max(120),
  description: z.string().max(2000).optional().default(""),
  priceStr: z.string().min(1, "Requerido"),
  currency: z.string().default("usd"),
  active: z.boolean().default(true),
  categorySlug: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().optional(),
        position: z.number().int().optional(),
      })
    )
    .max(8)
    .optional()
    .default([]),
});
type FormValues = z.infer<typeof FormSchema>;

export default function AdminProductEditorPage() {
  const { id } = useParams(); // undefined → crear
  const editing = Boolean(id);
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  /* Categorías */
  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin:categories"],
    queryFn: adminListCategories,
    staleTime: 5 * 60_000,
  });

  const catOptions = useMemo(() => {
    const parents = categories.filter((c) => !c.parentId);
    const childrenByParent = new Map<string, typeof categories>();
    categories.forEach((c) => {
      if (!c.parentId) return;
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c);
      childrenByParent.set(c.parentId, list);
    });
    const flat: Array<{ value: string; label: string }> = [
      { value: "", label: "Sin categoría" },
    ];
    parents.forEach((p) => {
      (childrenByParent.get(p.id) ?? []).forEach((s) => {
        flat.push({ value: s.slug, label: `${p.name} › ${s.name}` });
      });
      flat.push({ value: p.slug, label: `${p.name} (todo)` });
    });
    if (flat.length === 1) {
      categories.forEach((c) => flat.push({ value: c.slug, label: c.name }));
    }
    return flat;
  }, [categories]);

  /* Producto si editamos */
  const { data: product, isLoading: prodLoading } = useQuery<AdminProductDTO>({
    queryKey: ["admin:product", id],
    queryFn: () => adminGetProduct(id as string),
    enabled: editing,
  });

  /* Estado del form */
  const [values, setValues] = useState<FormValues>({
    name: "",
    description: "",
    priceStr: "",
    currency: "usd",
    active: true,
    categorySlug: "",
    images: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  /* Inicialización al editar */
  useEffect(() => {
    if (!editing || !product) return;
    setValues({
      name: product.name ?? "",
      description: product.description ?? "",
      priceStr: (product.price / 100).toString(), // sin formato “bonito”, editable y claro
      currency: product.currency || "usd",
      active: !!product.active,
      categorySlug: product.category?.slug || "",
      images:
        (product.images ?? []).map((im, idx) => ({
          url: im.url,
          publicId: im.publicId,
          position: typeof im.position === "number" ? im.position : idx,
        })) ?? [],
    });
  }, [editing, product]);

  /* Snapshot para detectar cambios (barra sticky) */
  useEffect(() => {
    setInitialSnapshot(JSON.stringify(values));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, prodLoading]);

  const dirty = useMemo(
    () => initialSnapshot !== JSON.stringify(values),
    [initialSnapshot, values]
  );

  /* Mutations */
  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof adminCreateProduct>[0]) =>
      adminCreateProduct(payload),
    onSuccess: () => {
      toast({ title: "Producto creado", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
      nav(`/admin/products`);
    },
    onError: (e: any) =>
      toast({
        title: e?.response?.data?.error || "No se pudo crear",
        variant: "error",
      }),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof adminUpdateProduct>[1];
    }) => adminUpdateProduct(id, patch),
    onSuccess: () => {
      toast({ title: "Producto actualizado", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:products"] });
      setInitialSnapshot(JSON.stringify(values));
    },
    onError: (e: any) =>
      toast({
        title: e?.response?.data?.error || "No se pudo actualizar",
        variant: "error",
      }),
  });

  const busy = createMut.isPending || updateMut.isPending;

  /* Guardar */
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault?.();
    setErrors({});

    const parsed = FormSchema.safeParse(values);
    if (!parsed.success) {
      const map: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0]?.toString() || "form";
        map[k] = i.message;
      });
      setErrors(map);
      return;
    }

    const cents = strToCents(values.priceStr);
    if (cents === null || cents < 0) {
      setErrors((prev) => ({ ...prev, priceStr: "Precio inválido" }));
      return;
    }

    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() ?? "",
      price: cents,
      currency: values.currency || "usd",
      active: values.active,
      categorySlug: values.categorySlug || undefined,
      images: (values.images ?? []).map((im, idx) => ({
        url: im.url,
        publicId: im.publicId,
        position: typeof im.position === "number" ? im.position : idx,
      })),
    };

    if (!editing) {
      await createMut.mutateAsync(payload);
    } else {
      await updateMut.mutateAsync({ id: id!, patch: payload });
    }
  }

  /* Atajo ⌘/Ctrl+S */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = ["input", "textarea", "select"].includes(
        (target?.tagName || "").toLowerCase()
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!busy) handleSubmit();
      }
      if (!typing && e.key === "Escape") {
        // volver rápido si no hay cambios
        if (!dirty) nav("/admin/products");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, dirty]); // eslint-disable-line

  /* UI */
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs opacity-70">
            <Link
              to="/admin/products"
              className="underline underline-offset-2 hover:opacity-100"
            >
              Productos
            </Link>
            <span className="mx-1">/</span>
            <span>{editing ? "Editar" : "Nuevo"}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {editing ? product?.name ?? "Editar producto" : "Crear producto"}
          </h1>
        </div>

        <div className="flex gap-2">
          <Link to="/admin/products">
            <Button variant="secondary" className="h-10">
              Volver
            </Button>
          </Link>
          <Button
            onClick={handleSubmit as any}
            disabled={busy}
            className="h-10"
          >
            {editing ? "Guardar cambios" : "Crear producto"}
          </Button>
        </div>
      </div>

      {/* Contenido */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-12 gap-6"
      >
        {/* Formulario principal */}
        <div className="md:col-span-7 space-y-5">
          <section className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-5 space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm opacity-80">Nombre</label>
                <Input
                  className="h-10"
                  value={values.name}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, name: e.target.value }))
                  }
                  placeholder="Ej: Zapatilla Runner Pro"
                />
                {errors.name && (
                  <p className="text-xs text-red-400 mt-1" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm opacity-80">Descripción</label>
                <textarea
                  value={values.description}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, description: e.target.value }))
                  }
                  placeholder="Describe el producto"
                  rows={8}
                  className="w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--border-rgb))]/60 transition"
                />
                {errors.description && (
                  <p className="text-xs text-red-400 mt-1" role="alert">
                    {errors.description}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm opacity-80">Precio</label>
                <Input
                  inputMode="decimal"
                  className="h-10"
                  value={values.priceStr}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, priceStr: e.target.value }))
                  }
                  placeholder="19.99"
                />
                {errors.priceStr && (
                  <p className="text-xs text-red-400 mt-1" role="alert">
                    {errors.priceStr}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm opacity-80">Moneda</label>
                <select
                  className="h-10 w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 text-sm outline-none"
                  value={values.currency}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, currency: e.target.value }))
                  }
                >
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="mxn">MXN</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values.active}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, active: e.target.checked }))
                    }
                  />
                  <span className="text-sm opacity-80">
                    {values.active ? "Activo" : "Inactivo"}
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm opacity-80">Categoría</label>
                {catsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <select
                    className="h-10 w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 text-sm outline-none"
                    value={values.categorySlug || ""}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        categorySlug: e.target.value || undefined,
                      }))
                    }
                  >
                    {catOptions.map((o) => (
                      <option key={o.value || "_none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </section>

          {/* Info técnica (solo al editar) */}
          {editing && (
            <section className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="opacity-70 mb-1">ID</div>
                <div className="font-mono text-xs opacity-80 break-all">
                  {product?.id}
                </div>
              </div>
              <div>
                <div className="opacity-70 mb-1">Slug</div>
                <div className="font-mono text-xs opacity-80 break-all">
                  {product?.slug}
                </div>
              </div>
              <div>
                <div className="opacity-70 mb-1">Creado</div>
                <div className="text-xs opacity-70">
                  {product?.createdAt
                    ? new Date(product.createdAt).toLocaleString()
                    : "—"}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Lateral imágenes (sticky) */}
        <div className="md:col-span-5 space-y-5 lg:sticky lg:top-20 self-start">
          <section className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Imágenes</div>
              <div className="text-[11px] opacity-60">
                La #1 será la portada
              </div>
            </div>

            {editing && prodLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : (
              <ImageUploader
                value={(values.images as UImage[]) ?? []}
                onChange={(imgs) => setValues((v) => ({ ...v, images: imgs }))}
                max={8}
              />
            )}
          </section>
        </div>
      </form>

      {/* Barra sticky inferior (si hay cambios) */}
      <div
        className={[
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 transition-all",
          dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)]">
          <div className="pointer-events-auto rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] shadow-lg p-3 flex items-center justify-between">
            <div className="text-sm opacity-80">Tienes cambios sin guardar</div>
            <div className="flex gap-2">
              <Link to="/admin/products">
                <Button variant="secondary" className="h-9">
                  Descartar
                </Button>
              </Link>
              <Button
                onClick={handleSubmit as any}
                disabled={busy}
                className="h-9"
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
