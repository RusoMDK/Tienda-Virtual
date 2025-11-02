// src/features/admin/components/CategoryForm.tsx
import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@/ui";
import { slugify } from "@/lib/slug";
import type {} from "react"; // para TS feliz

export type CategoryItem = {
  id?: string;
  name: string;
  slug: string;
  parentId: string | null;
};

type Option = { value: string | null; label: string };

type Props = {
  initial?: Partial<CategoryItem>;
  options: Option[]; // opciones para el select de padre
  onSubmit: (values: CategoryItem) => Promise<void> | void;
  onCancel?: () => void;
  busy?: boolean;
};

export default function CategoryForm({
  initial,
  options,
  onSubmit,
  onCancel,
  busy,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [parentId, setParentId] = useState<string | null>(
    initial?.parentId ?? null
  );
  const [autoSlug, setAutoSlug] = useState(true);

  useEffect(() => {
    if (autoSlug) setSlug(slugify(name));
  }, [name, autoSlug]);

  const parentOptions = useMemo<Option[]>(
    () => [{ value: null, label: "— Sin padre —" }, ...options],
    [options]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    await onSubmit({
      id: initial?.id,
      name: name.trim(),
      slug: slug.trim(),
      parentId: parentId || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs opacity-70">Nombre</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Electrónica"
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs opacity-70">Slug</label>
          <label className="text-xs opacity-70 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSlug}
              onChange={(e) => setAutoSlug(e.target.checked)}
            />
            Auto
          </label>
        </div>
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={autoSlug}
          placeholder="electronica"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs opacity-70">Padre</label>
        <select
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
          value={parentId ?? ""}
          onChange={(e) => setParentId(e.target.value || null)}
        >
          {parentOptions.map((o) => (
            <option key={String(o.value)} value={o.value ?? ""}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {initial?.id ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    </form>
  );
}
