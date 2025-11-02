// src/features/admin/components/AdminProductForm.tsx
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@/ui";
import {
  adminListCategories,
  type AdminProduct,
  type AdminProductImage,
  type AdminProductPayload,
} from "@/features/admin/api";
import ImageUploader from "./ImageUploader";

const Schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  description: z.string().max(2000).optional().default(""),
  priceUsd: z.coerce.number().min(0, "Precio inválido"),
  currency: z.string().default("usd"),
  active: z.boolean().default(true),
  categorySlug: z.string().optional().or(z.literal("")),
  images: z.any().optional(), // lo gestionamos a mano
});
type FormValues = z.infer<typeof Schema>;

type Props = {
  mode: "create" | "edit";
  initial?: Partial<AdminProduct>;
  onSubmit: (payload: AdminProductPayload) => Promise<void> | void;
  submitting?: boolean;
};

export default function AdminProductForm({
  mode,
  initial,
  onSubmit,
  submitting,
}: Props) {
  const [cats, setCats] = useState<
    { id: string; name: string; slug: string; parentId: string | null }[]
  >([]);
  const [images, setImages] = useState<AdminProductImage[]>(() => {
    const imgs = (initial?.images || []) as AdminProductImage[];
    // normaliza posición
    return imgs.map((img, i) => ({
      ...img,
      position: typeof img.position === "number" ? img.position : i,
    }));
  });

  const defaultValues: FormValues = useMemo(
    () => ({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      priceUsd: typeof initial?.price === "number" ? initial!.price / 100 : 0,
      currency: initial?.currency ?? "usd",
      active: typeof initial?.active === "boolean" ? initial!.active : true,
      categorySlug: initial?.category?.slug ?? "",
      images: undefined, // controlado por estado `images`
    }),
    [initial]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues,
  });

  // cargar categorías una vez
  useEffect(() => {
    (async () => {
      const list = await adminListCategories();
      setCats(list);
    })();
  }, []);

  // si cambian initial (ej. al abrir modal de editar)
  useEffect(() => {
    reset(defaultValues);
    setImages(
      (initial?.images || []).map((img, i) => ({
        ...img,
        position: typeof img.position === "number" ? img.position : i,
      }))
    );
  }, [initial, reset, defaultValues]);

  // armar árbol padre->hijos
  const parents = useMemo(() => cats.filter((c) => !c.parentId), [cats]);
  const childrenByParent = useMemo(() => {
    const map: Record<string, typeof cats> = {};
    for (const c of cats) {
      if (!c.parentId) continue;
      if (!map[c.parentId]) map[c.parentId] = [];
      map[c.parentId].push(c);
    }
    return map;
  }, [cats]);

  async function submit(values: FormValues) {
    const payload: AdminProductPayload = {
      name: values.name.trim(),
      description: values.description?.trim() || "",
      price: Math.round(values.priceUsd * 100),
      currency: values.currency || "usd",
      active: !!values.active,
      categorySlug: values.categorySlug ? values.categorySlug : null, // null → desconecta
      images: images.length
        ? images.map((img, i) => ({
            url: img.url,
            publicId: img.publicId,
            position: i,
          }))
        : undefined,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nombre */}
        <div>
          <label className="text-sm opacity-80">Nombre</label>
          <Input {...register("name")} placeholder="Ej: Auriculares Pro X" />
          {errors.name && (
            <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Precio USD */}
        <div>
          <label className="text-sm opacity-80">Precio (USD)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register("priceUsd")}
            placeholder="99.99"
          />
          {errors.priceUsd && (
            <p className="text-xs text-red-400 mt-1">
              {errors.priceUsd.message}
            </p>
          )}
        </div>

        {/* Activo */}
        <div className="flex items-center gap-2">
          <input
            id="active"
            type="checkbox"
            {...register("active")}
            defaultChecked={defaultValues.active}
          />
          <label htmlFor="active" className="text-sm opacity-80">
            Activo
          </label>
        </div>

        {/* Categoría */}
        <div>
          <label className="text-sm opacity-80">Categoría</label>
          <select
            {...register("categorySlug")}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
            defaultValue={defaultValues.categorySlug || ""}
          >
            <option value="">— Sin categoría —</option>
            {parents.map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={p.slug}>{p.name} (todo)</option>
                {(childrenByParent[p.id] || []).map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Descripción (full width en mobile) */}
        <div className="md:col-span-2">
          <label className="text-sm opacity-80">Descripción</label>
          <textarea
            {...register("description")}
            rows={4}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
            placeholder="Detalles del producto…"
          />
          {errors.description && (
            <p className="text-xs text-red-400 mt-1">
              {errors.description.message}
            </p>
          )}
        </div>
      </div>

      {/* Imágenes */}
      <div className="space-y-2">
        <div className="text-sm opacity-80">Imágenes</div>
        <ImageUploader value={images} onChange={setImages} max={8} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Guardando…"
            : mode === "create"
            ? "Crear"
            : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
