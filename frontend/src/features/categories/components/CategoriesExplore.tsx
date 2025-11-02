import type { CategoryNode } from "@/features/categories/api";
import SubcategoryCard from "./SubcategoryCard";

type Props = {
  categories: CategoryNode[]; // incluye "all"
  parentSlug: string; // categoría padre seleccionada
  onPick: (slug: string) => void;
};

const PLACEHOLDER =
  "https://placehold.co/1200x700/png?text=Categor%C3%ADa&font=source-sans-pro";

export default function CategoriesExplore({
  categories,
  parentSlug,
  onPick,
}: Props) {
  const parent = categories.find((c) => c.slug === parentSlug);
  const subs = parent?.sub || [];

  return (
    <section id="explorar" className="container py-8 sm:py-10">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl font-semibold">
          Explorar {parent?.name || "categorías"}
        </h2>
        <p className="text-sm text-[rgb(var(--fg-rgb)/0.72)]">
          Elige una subcategoría para afinar tu búsqueda.
        </p>
      </div>

      {subs.length === 0 ? (
        <div className="rounded-2xl border bg-[rgb(var(--card-rgb))] p-5 text-sm text-[rgb(var(--fg-rgb)/0.8)]">
          Esta categoría aún no tiene subcategorías.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {/* “Todo <padre>” usa imagen del padre si existe */}
          <SubcategoryCard
            name={`Todo ${parent?.name ?? ""}`}
            slug={parentSlug}
            imageUrl={(parent as any)?.imageUrl || PLACEHOLDER}
            onClick={onPick}
          />
          {subs.map((s) => (
            <SubcategoryCard
              key={s.slug}
              name={s.name}
              slug={s.slug}
              imageUrl={(s as any).imageUrl || null}
              onClick={onPick}
            />
          ))}
        </div>
      )}
    </section>
  );
}
