// src/features/categories/components/CategoryBar.tsx
import { useMemo } from "react";
import type { CategoryNode } from "@/features/categories/api";

type Props = {
  categories: CategoryNode[]; // incluye "all" + padres
  selectedParent: string; // slug del padre seleccionado
  onSelectParent: (slug: string) => void;
  scrollTargetId?: string; // id de la sección "explorar"
};

export default function CategoryBar({
  categories,
  selectedParent,
  onSelectParent,
  scrollTargetId = "explorar",
}: Props) {
  const parents = useMemo(
    () => (categories || []).filter((c) => c.slug !== "all"),
    [categories]
  );

  function handleClick(slug: string) {
    onSelectParent(slug);
    const el = document.getElementById(scrollTargetId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="border-b border bg-[rgb(var(--bg-rgb)/0.6)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--bg-rgb)/0.45)]">
      <div className="container">
        <nav className="flex items-center justify-center gap-2 sm:gap-3 py-2 sm:py-3 flex-wrap">
          {parents.map((p) => {
            const active = p.slug === selectedParent;
            return (
              <button
                key={p.slug}
                onClick={() => handleClick(p.slug)}
                title={`Explorar ${p.name}`}
                className={[
                  "rounded-full px-3 py-1.5 text-sm transition-colors border",
                  active
                    ? "bg-[rgb(var(--primary-rgb)/0.12)] border-[rgb(var(--primary-rgb)/0.45)] text-[rgb(var(--primary-rgb))]"
                    : "bg-[rgb(var(--card-rgb))] hover:bg-[rgb(var(--card-2-rgb))]",
                ].join(" ")}
              >
                {p.name}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
