import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Sparkles,
  LayoutTemplate,
  Eye,
} from "lucide-react";
import { Button, Input, Textarea, Switch, Skeleton } from "@/ui";
import Modal from "@/ui/modal";
import Label from "@/ui/label";
import Spinner from "@/ui/spinner";
import { useToast } from "@/ui/toast";
import type { HomeSection, HomeSectionType } from "@/features/home/types";
import {
  adminListHomeSections,
  adminCreateHomeSection,
  adminUpdateHomeSection,
  adminDeleteHomeSection,
  adminReorderHomeSections,
} from "../api/homeSections";
import { api } from "@/lib/api";
import { uploadToCloudinary } from "@/features/uploads/cloudinary";
import {
  HOME_TEMPLATES,
  type TemplateDefinition,
  type TemplateSectionSeed,
} from "../home/templates";
import type { CategoryNode } from "@/features/categories/api";

/* =========================
   Tipos auxiliares
   ========================= */

type ProductMode = "LATEST" | "BY_CATEGORY" | "BEST_SELLERS";

type ProductLayoutVariant =
  | "grid-2"
  | "grid-3"
  | "grid-4"
  | "strip-sm"
  | "strip-md";

type CategoryVariant = "chips" | "cards" | "compact";

type BannerTone = "brand" | "soft" | "dark";

type TextAlign = "left" | "center" | "right";

const SECTION_TYPES: { value: HomeSectionType; label: string }[] = [
  { value: "HERO", label: "Hero principal" },
  { value: "PRODUCT_GRID", label: "Grid de productos" },
  { value: "PRODUCT_STRIP", label: "Tira horizontal" },
  { value: "CATEGORY_STRIP", label: "Tira de categorías" },
  { value: "BANNER", label: "Banner" },
  { value: "TEXT_BLOCK", label: "Bloque de texto" },
];

type Draft = {
  id?: string;
  slug: string;
  type: HomeSectionType;
  title: string;
  subtitle: string;
  active: boolean;

  // HERO
  heroCtaLabel: string;
  heroCtaHref: string;
  heroShowSearch: boolean;
  heroBackgroundUrl: string;

  // PRODUCT GRID / STRIP
  prodMode: ProductMode;
  prodCategorySlug: string;
  prodLimit: number;
  prodLayoutVariant: ProductLayoutVariant;
  prodShowAddToCart: boolean;
  prodShowRating: boolean;

  // CATEGORY STRIP
  catSlugs: string[];
  catVariant: CategoryVariant;

  // BANNER
  bannerCtaLabel: string;
  bannerCtaHref: string;
  bannerTone: BannerTone;

  // TEXT BLOCK
  textContent: string;
  textAlign: TextAlign;
};

const EMPTY_DRAFT: Draft = {
  slug: "",
  type: "HERO",
  title: "",
  subtitle: "",
  active: true,

  heroCtaLabel: "Ver catálogo",
  heroCtaHref: "/tienda",
  heroShowSearch: true,
  heroBackgroundUrl: "",

  prodMode: "LATEST",
  prodCategorySlug: "",
  prodLimit: 8,
  prodLayoutVariant: "grid-3",
  prodShowAddToCart: true,
  prodShowRating: false,

  catSlugs: [],
  catVariant: "chips",

  bannerCtaLabel: "",
  bannerCtaHref: "",
  bannerTone: "brand",

  textContent: "",
  textAlign: "left",
};

/* =========================
   Categorías para selects
   ========================= */

type CategoryOption = { slug: string; label: string };

// Aplana categorías (padres + subcategorías)
function flattenCategories(
  nodes: CategoryNode[],
  prefix = ""
): CategoryOption[] {
  const out: CategoryOption[] = [];
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    out.push({ slug: n.slug, label });
    if (n.sub && n.sub.length) {
      out.push(...flattenCategories(n.sub, label));
    }
  }
  return out;
}

/* =========================
   Helpers: HomeSection ↔ Draft
   ========================= */

function sectionToDraft(section: HomeSection | null): Draft {
  if (!section) return { ...EMPTY_DRAFT };

  const cfg = (section as any).config ?? {};
  const layout = (section as any).layout ?? {};

  const base: Draft = {
    ...EMPTY_DRAFT,
    id: section.id,
    slug: section.slug,
    type: section.type,
    title: section.title ?? "",
    subtitle: section.subtitle ?? "",
    active: (section as any).active ?? true,
  };

  switch (section.type) {
    case "HERO": {
      return {
        ...base,
        heroCtaLabel: cfg.ctaLabel ?? "Ver catálogo",
        heroCtaHref: cfg.ctaHref ?? "/tienda",
        heroShowSearch: cfg.showSearch ?? true,
        heroBackgroundUrl:
          cfg.backgroundImage?.url ?? cfg.backgroundImageUrl ?? "",
      };
    }

    case "PRODUCT_GRID":
    case "PRODUCT_STRIP": {
      return {
        ...base,
        prodMode: (cfg.mode as ProductMode) ?? "LATEST",
        prodCategorySlug: cfg.categorySlug ?? "",
        prodLimit: typeof cfg.limit === "number" ? cfg.limit : 8,
        prodLayoutVariant:
          (layout.variant as ProductLayoutVariant) ??
          (section.type === "PRODUCT_GRID" ? "grid-3" : "strip-md"),
        prodShowAddToCart: layout.showAddToCart ?? true,
        prodShowRating: layout.showRating ?? false,
      };
    }

    case "CATEGORY_STRIP": {
      return {
        ...base,
        catSlugs: Array.isArray(cfg.categories)
          ? cfg.categories.filter((x: any) => typeof x === "string")
          : [],
        catVariant: (layout.variant as CategoryVariant) ?? "chips",
      };
    }

    case "BANNER": {
      return {
        ...base,
        bannerCtaLabel: cfg.ctaLabel ?? "",
        bannerCtaHref: cfg.ctaHref ?? "",
        bannerTone: (layout.tone as BannerTone) ?? "brand",
      };
    }

    case "TEXT_BLOCK": {
      return {
        ...base,
        textContent: cfg.text ?? "",
        textAlign: (layout.align as TextAlign) ?? "left",
      };
    }

    default:
      return base;
  }
}

function draftToPayload(draft: Draft) {
  let config: any = {};
  let layout: any = {};

  switch (draft.type) {
    case "HERO": {
      config = {
        mode: "STATIC",
        ctaLabel: draft.heroCtaLabel || "Ver catálogo",
        ctaHref: draft.heroCtaHref || "/tienda",
        showSearch: draft.heroShowSearch,
        backgroundImageUrl: draft.heroBackgroundUrl || null,
      };
      layout = {
        kind: "hero",
        align: "left",
      };
      break;
    }

    case "PRODUCT_GRID":
    case "PRODUCT_STRIP": {
      config = {
        mode: draft.prodMode,
        categorySlug:
          draft.prodMode === "BY_CATEGORY" && draft.prodCategorySlug
            ? draft.prodCategorySlug
            : undefined,
        limit: draft.prodLimit,
      };
      layout = {
        variant: draft.prodLayoutVariant,
        showAddToCart: draft.prodShowAddToCart,
        showRating: draft.prodShowRating,
      };
      break;
    }

    case "CATEGORY_STRIP": {
      config = {
        categories: draft.catSlugs,
      };
      layout = {
        variant: draft.catVariant,
      };
      break;
    }

    case "BANNER": {
      config = {
        ctaLabel: draft.bannerCtaLabel || undefined,
        ctaHref: draft.bannerCtaHref || undefined,
      };
      layout = {
        tone: draft.bannerTone,
      };
      break;
    }

    case "TEXT_BLOCK": {
      config = {
        text: draft.textContent,
      };
      layout = {
        align: draft.textAlign,
      };
      break;
    }
  }

  return {
    slug: draft.slug.trim(),
    type: draft.type,
    title: draft.title.trim() || null,
    subtitle: draft.subtitle.trim() || null,
    active: draft.active,
    config,
    layout,
  };
}

/* =========================
   Página principal
   ========================= */

export default function AdminHomePage() {
  const qc = useQueryClient();
  const toast = useToast();

  const notify = (options: {
    title: string;
    description?: string;
    variant?: "success" | "error";
  }) => {
    toast({
      title: options.title,
      description: options.description,
      variant: options.variant ?? "default",
    });
  };

  // Secciones
  const { data, isLoading } = useQuery<HomeSection[]>({
    queryKey: ["admin:homeSections"],
    queryFn: adminListHomeSections,
    staleTime: 60_000,
  });

  // Categorías
  const { data: catTree, isLoading: catsLoading } = useQuery<CategoryNode[]>({
    queryKey: ["categories:flat"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data as CategoryNode[];
    },
    staleTime: 10 * 60_000,
  });

  // Para PRODUCT_GRID / PRODUCT_STRIP: padres + subcategorías (sin "all")
  const categoryOptions: CategoryOption[] = useMemo(
    () =>
      catTree ? flattenCategories(catTree.filter((c) => c.slug !== "all")) : [],
    [catTree]
  );

  // Para CATEGORY_STRIP: SOLO categorías padre (sin "all")
  const parentCategoryOptions: CategoryOption[] = useMemo(
    () =>
      catTree
        ? catTree
            .filter((c) => c.slug !== "all")
            .map((c) => ({ slug: c.slug, label: c.name }))
        : [],
    [catTree]
  );

  const [sections, setSections] = useState<HomeSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });

  // Modal de selección de plantilla
  const [templateToApply, setTemplateToApply] =
    useState<TemplateDefinition | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [heroBgUrl, setHeroBgUrl] = useState("");
  const [showPreviewInModal, setShowPreviewInModal] = useState(true);
  const [isUploadingHeroImage, setIsUploadingHeroImage] = useState(false);

  useEffect(() => {
    if (data) {
      setSections(data);
      if (!selectedId && data.length) {
        selectSection(data[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function selectSection(sec: HomeSection | null) {
    if (!sec) {
      setSelectedId(null);
      setDraft({ ...EMPTY_DRAFT });
      return;
    }
    setSelectedId(sec.id);
    setDraft(sectionToDraft(sec));
  }

  function newSection() {
    setSelectedId(null);
    setDraft({ ...EMPTY_DRAFT });
  }

  function openTemplateModal(tpl: TemplateDefinition) {
    setTemplateToApply(tpl);
    const hero = tpl.sections.find((s) => s.type === "HERO");
    const existingBg =
      (hero?.config?.backgroundImage?.url as string) ||
      (hero?.config?.backgroundImageUrl as string) ||
      "";
    setHeroBgUrl(existingBg || "");
    setShowPreviewInModal(true);
    setTemplateModalOpen(true);
  }

  function closeTemplateModal() {
    if (applyTemplateMut.isPending) return;
    setTemplateModalOpen(false);
    setTimeout(() => {
      setTemplateToApply(null);
      setHeroBgUrl("");
    }, 180);
  }

  // Uploader Cloudinary
  async function handleHeroImageFileChange(e: any) {
    const file = e.target?.files?.[0];
    if (!file) return;

    try {
      setIsUploadingHeroImage(true);

      const { url } = await uploadToCloudinary(file, {
        alias: "root",
        folder: "home",
        resourceType: "image",
        maxBytes: 8 * 1024 * 1024,
        acceptMime: ["image/jpeg", "image/png", "image/webp"],
        onProgress: () => {},
      });

      if (!url) {
        throw new Error("La subida a Cloudinary no devolvió una URL.");
      }

      setHeroBgUrl(url);

      notify({
        title: "Imagen subida",
        description: "Usaremos esta imagen como fondo del hero.",
        variant: "success",
      });
    } catch (err: any) {
      console.error(err);
      notify({
        title: "Error al subir la imagen",
        description: err?.message || "No se pudo subir la imagen a Cloudinary.",
        variant: "error",
      });
    } finally {
      setIsUploadingHeroImage(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  const createMut = useMutation({
    mutationFn: adminCreateHomeSection,
    onSuccess: () => {
      notify({ title: "Sección creada", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:homeSections"] });
      qc.invalidateQueries({ queryKey: ["home:sections"] });
      setDraft({ ...EMPTY_DRAFT });
      setSelectedId(null);
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "No se pudo crear la sección.";
      notify({ title: msg, variant: "error" });
    },
  });

  const updateMut = useMutation({
    mutationFn: (input: {
      id: string;
      data: Parameters<typeof adminUpdateHomeSection>[1];
    }) => adminUpdateHomeSection(input.id, input.data),
    onSuccess: () => {
      notify({ title: "Sección actualizada", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:homeSections"] });
      qc.invalidateQueries({ queryKey: ["home:sections"] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "No se pudo actualizar.";
      notify({ title: msg, variant: "error" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteHomeSection(id),
    onSuccess: () => {
      notify({ title: "Sección eliminada", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin:homeSections"] });
      qc.invalidateQueries({ queryKey: ["home:sections"] });
      setSelectedId(null);
      setDraft({ ...EMPTY_DRAFT });
    },
    onError: () => {
      notify({ title: "No se pudo eliminar.", variant: "error" });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (order: string[]) => adminReorderHomeSections(order),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:homeSections"] });
      qc.invalidateQueries({ queryKey: ["home:sections"] });
    },
    onError: () => {
      notify({ title: "No se pudo reordenar.", variant: "error" });
    },
  });

  const applyTemplateMut = useMutation({
    mutationFn: async (input: {
      template: TemplateDefinition;
      heroBackgroundUrl?: string;
      existingSections: HomeSection[];
    }) => {
      const { template, heroBackgroundUrl, existingSections } = input;

      // Borrar secciones actuales
      for (const s of existingSections) {
        try {
          await adminDeleteHomeSection(s.id);
        } catch {
          // ignoramos errores individuales
        }
      }

      // Crear secciones de la plantilla, en orden
      for (const seed of template.sections) {
        const cfg = { ...(seed.config || {}) };

        if (heroBackgroundUrl && seed.type === "HERO") {
          cfg.backgroundImageUrl = heroBackgroundUrl;
        }

        await adminCreateHomeSection({
          slug: seed.slug,
          type: seed.type,
          title: seed.title,
          subtitle: seed.subtitle ?? null,
          active: seed.active ?? true,
          config: cfg,
          layout: seed.layout,
        } as any);
      }
    },
    onSuccess: () => {
      notify({
        title: "Plantilla aplicada",
        description: "El inicio se actualizó con la plantilla seleccionada.",
        variant: "success",
      });

      qc.invalidateQueries({ queryKey: ["admin:homeSections"] });
      qc.invalidateQueries({ queryKey: ["home:sections"] });

      setTemplateModalOpen(false);
      setTemplateToApply(null);
      setHeroBgUrl("");
    },
    onError: () => {
      notify({
        title: "No se pudo aplicar la plantilla",
        variant: "error",
      });
    },
  });

  function confirmApplyTemplate() {
    if (!templateToApply) return;
    applyTemplateMut.mutate({
      template: templateToApply,
      heroBackgroundUrl: heroBgUrl || undefined,
      existingSections: sections,
    });
  }

  function save() {
    const slug = draft.slug.trim();
    if (!slug) {
      notify({
        title: "Slug requerido",
        description: "El slug identifica la sección.",
        variant: "error",
      });
      return;
    }

    const payload = draftToPayload(draft);

    if (draft.id) {
      updateMut.mutate({ id: draft.id, data: payload });
    } else {
      createMut.mutate(payload as any);
    }
  }

  function remove() {
    if (!draft.id) return;
    if (
      !confirm(
        `¿Eliminar la sección “${
          draft.title || draft.slug
        }”? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    deleteMut.mutate(draft.id);
  }

  function move(id: string, dir: "up" | "down") {
    setSections((current) => {
      const idx = current.findIndex((s) => s.id === id);
      if (idx === -1) return current;
      const next = [...current];
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      reorderMut.mutate(next.map((s) => s.id));
      return next;
    });
  }

  function addCategoryToStrip(slug: string) {
    if (!slug) return;
    setDraft((d) =>
      d.catSlugs.includes(slug) ? d : { ...d, catSlugs: [...d.catSlugs, slug] }
    );
  }

  function removeCategoryFromStrip(slug: string) {
    setDraft((d) => ({
      ...d,
      catSlugs: d.catSlugs.filter((s) => s !== slug),
    }));
  }

  const loading = isLoading;

  /* =========================
     UI específicos por tipo
     ========================= */

  function renderTypeFields() {
    const type = draft.type;

    if (type === "HERO") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Texto del botón
              </label>
              <Input
                value={draft.heroCtaLabel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, heroCtaLabel: e.target.value }))
                }
                placeholder="Ver catálogo"
              />
            </div>
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Enlace del botón
              </label>
              <Input
                value={draft.heroCtaHref}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, heroCtaHref: e.target.value }))
                }
                placeholder="/tienda"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={draft.heroShowSearch}
              onChange={(val) =>
                setDraft((d) => ({ ...d, heroShowSearch: !!val }))
              }
            />
            <span className="text-xs">
              Mostrar buscador incrustado debajo del hero
            </span>
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">
              Imagen de fondo (URL)
            </label>
            <Input
              value={draft.heroBackgroundUrl}
              onChange={(e) =>
                setDraft((d) => ({ ...d, heroBackgroundUrl: e.target.value }))
              }
              placeholder="https://…"
            />
            <p className="text-[11px] opacity-60 mt-1">
              Puedes pegar una URL o usar el uploader del modal de plantilla
              para guardar una imagen en Cloudinary (carpeta <code>home</code>).
            </p>
          </div>
        </div>
      );
    }

    if (type === "PRODUCT_GRID" || type === "PRODUCT_STRIP") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Fuente de productos
              </label>
              <select
                value={draft.prodMode}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    prodMode: e.target.value as ProductMode,
                  }))
                }
                className="w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-sm"
              >
                <option value="LATEST">Últimos añadidos</option>
                <option value="BY_CATEGORY">Por categoría</option>
                <option value="BEST_SELLERS">Más vendidos</option>
              </select>
            </div>

            {draft.prodMode === "BY_CATEGORY" && (
              <div>
                <label className="block text-xs opacity-70 mb-1">
                  Categoría
                </label>
                <select
                  value={draft.prodCategorySlug}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      prodCategorySlug: e.target.value,
                    }))
                  }
                  disabled={catsLoading || !categoryOptions.length}
                  className="w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-sm"
                >
                  <option value="">
                    {catsLoading
                      ? "Cargando categorías…"
                      : "Seleccionar categoría…"}
                  </option>
                  {categoryOptions.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Cantidad de productos
              </label>
              <Input
                type="number"
                min={1}
                max={24}
                value={draft.prodLimit}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    prodLimit: Math.min(
                      24,
                      Math.max(1, Number(e.target.value) || 1)
                    ),
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-xs opacity-70 mb-1">
                Diseño de tarjetas
              </label>
              <select
                value={draft.prodLayoutVariant}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    prodLayoutVariant: e.target.value as ProductLayoutVariant,
                  }))
                }
                className="w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-sm"
              >
                {type === "PRODUCT_GRID" && (
                  <>
                    <option value="grid-2">2 por fila</option>
                    <option value="grid-3">3 por fila</option>
                    <option value="grid-4">4 por fila</option>
                  </>
                )}
                {type === "PRODUCT_STRIP" && (
                  <>
                    <option value="strip-sm">Tira compacta</option>
                    <option value="strip-md">Tira mediana</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={draft.prodShowAddToCart}
                onChange={(val) =>
                  setDraft((d) => ({ ...d, prodShowAddToCart: !!val }))
                }
              />
              Mostrar botón “Agregar al carrito”
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={draft.prodShowRating}
                onChange={(val) =>
                  setDraft((d) => ({ ...d, prodShowRating: !!val }))
                }
              />
              Mostrar rating si hay reseñas
            </label>
          </div>
        </div>
      );
    }

    if (type === "CATEGORY_STRIP") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">
              Categorías en la tira
            </label>
            <div className="flex flex-wrap gap-1 mb-2">
              {draft.catSlugs.length === 0 && (
                <span className="text-[11px] opacity-60">
                  Aún no hay categorías seleccionadas.
                </span>
              )}
              {draft.catSlugs.map((slug) => {
                const opt =
                  parentCategoryOptions.find((c) => c.slug === slug) ||
                  categoryOptions.find((c) => c.slug === slug);
                return (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-2 py-0.5 text-[11px]"
                  >
                    {opt?.label ?? slug}
                    <button
                      type="button"
                      onClick={() => removeCategoryFromStrip(slug)}
                      className="hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              onChange={(e) => {
                addCategoryToStrip(e.target.value);
                e.target.value = "";
              }}
              disabled={catsLoading || !parentCategoryOptions.length}
              className="w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-sm"
              value=""
            >
              <option value="">
                {catsLoading
                  ? "Cargando categorías…"
                  : "Añadir categoría principal…"}
              </option>
              {parentCategoryOptions
                .filter((c) => !draft.catSlugs.includes(c.slug))
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">Estilo</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  { value: "chips", label: "Chips" },
                  { value: "cards", label: "Tarjetas con imagen" },
                  { value: "compact", label: "Compacto" },
                ] as { value: CategoryVariant; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, catVariant: opt.value }))
                  }
                  className={[
                    "px-3 py-1 rounded-full border text-xs",
                    draft.catVariant === opt.value
                      ? "border-[rgb(var(--primary-rgb))] bg-[rgb(var(--primary-rgb)/0.12)]"
                      : "border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (type === "BANNER") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Texto del botón (opcional)
              </label>
              <Input
                value={draft.bannerCtaLabel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, bannerCtaLabel: e.target.value }))
                }
                placeholder="Ver ofertas"
              />
            </div>
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Enlace del botón (opcional)
              </label>
              <Input
                value={draft.bannerCtaHref}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, bannerCtaHref: e.target.value }))
                }
                placeholder="/tienda"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs opacity-70 mb-1">Estilo</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  { value: "brand", label: "Color marca" },
                  { value: "soft", label: "Suave" },
                  { value: "dark", label: "Oscuro" },
                ] as { value: BannerTone; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, bannerTone: opt.value }))
                  }
                  className={[
                    "px-3 py-1 rounded-full border text-xs",
                    draft.bannerTone === opt.value
                      ? "border-[rgb(var(--primary-rgb))] bg-[rgb(var(--primary-rgb)/0.12)]"
                      : "border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (type === "TEXT_BLOCK") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">Contenido</label>
            <Textarea
              value={draft.textContent}
              onChange={(e) =>
                setDraft((d) => ({ ...d, textContent: e.target.value }))
              }
              rows={8}
              className="text-sm"
              placeholder="Escribe aquí el texto que quieres mostrar…"
            />
          </div>
          <div>
            <label className="block text-xs opacity-70 mb-1">Alineación</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  { value: "left", label: "Izquierda" },
                  { value: "center", label: "Centrado" },
                  { value: "right", label: "Derecha" },
                ] as { value: TextAlign; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, textAlign: opt.value }))
                  }
                  className={[
                    "px-3 py-1 rounded-full border text-xs",
                    draft.textAlign === opt.value
                      ? "border-[rgb(var(--primary-rgb))] bg-[rgb(var(--primary-rgb)/0.12)]"
                      : "border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))]",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  /* =========================
     Render
     ========================= */

  return (
    <>
      <div className="space-y-6">
        {/* Panel de plantillas */}
        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutTemplate size={18} />
              <div>
                <h2 className="text-sm font-semibold">Plantillas rápidas</h2>
                <p className="text-[11px] opacity-70">
                  Elige una estructura de inicio prearmada. Puedes revisar la
                  vista previa y luego aplicarla.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {HOME_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className={[
                  "rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] p-3 flex flex-col gap-2 text-left transition",
                  "hover:border-[rgb(var(--ring-rgb))] hover:shadow-sm",
                ].join(" ")}
              >
                {/* Mini preview “wireframe” */}
                <div className="mb-1 space-y-1 text-[9px]">
                  <div className="h-6 rounded-lg bg-[rgb(var(--muted-rgb))]" />
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    <div className="h-5 rounded bg-[rgb(var(--muted-rgb))]" />
                    <div className="h-5 rounded bg-[rgb(var(--muted-rgb))]" />
                    <div className="h-5 rounded bg-[rgb(var(--muted-rgb))]" />
                    <div className="h-5 rounded bg-[rgb(var(--muted-rgb))]" />
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <div className="h-4 rounded bg-[rgb(var(--muted-rgb))]" />
                    <div className="h-4 rounded bg-[rgb(var(--muted-rgb))]" />
                    <div className="h-4 rounded bg-[rgb(var(--muted-rgb))]" />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <h3 className="text-sm font-semibold">{tpl.name}</h3>
                  {tpl.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[rgb(var(--primary-rgb))] bg-[rgb(var(--primary-rgb)/0.12)]">
                      {tpl.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-70 flex-1">
                  {tpl.description}
                </p>

                <div className="flex items-center justify-end gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => openTemplateModal(tpl)}
                  >
                    Seleccionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista + formulario */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,320px)_1fr] gap-5">
          {/* Lista */}
          <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1">
                <Sparkles size={14} />
                <span>Secciones de inicio</span>
              </h2>
              <Button size="sm" onClick={newSection}>
                <Plus size={14} className="mr-1" />
                Nueva
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : sections.length === 0 ? (
              <div className="text-xs opacity-70 space-y-1">
                <p>Aún no hay secciones.</p>
                <p>
                  Usa una plantilla de arriba o crea una{" "}
                  <strong>“Hero principal”</strong> para empezar.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sections.map((s, idx) => {
                  const isActive = (s as any).active ?? true;
                  const isSelected = selectedId === s.id;
                  const typeLabel =
                    SECTION_TYPES.find((t) => t.value === s.type)?.label ||
                    s.type;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => selectSection(s)}
                        className={[
                          "w-full flex items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs transition",
                          "border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))]",
                          "hover:bg-[rgb(var(--muted-rgb))]",
                          isSelected
                            ? "ring-2 ring-[rgb(var(--ring-rgb))]"
                            : "",
                          !isActive ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium truncate">
                            {s.title || s.slug}
                          </span>
                          <span className="text-[11px] opacity-70 truncate">
                            {typeLabel}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-[10px]">
                          <span
                            className={
                              isActive
                                ? "px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "px-1.5 py-0.5 rounded-full bg-zinc-800/40 text-zinc-200 border border-zinc-700"
                            }
                          >
                            {isActive ? "Activo" : "Oculto"}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                move(s.id, "up");
                              }}
                              disabled={idx === 0}
                              className="rounded-lg p-1 hover:bg-[rgb(var(--muted-rgb))] disabled:opacity-40"
                              aria-label="Subir"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                move(s.id, "down");
                              }}
                              disabled={idx === sections.length - 1}
                              className="rounded-lg p-1 hover:bg-[rgb(var(--muted-rgb))] disabled:opacity-40"
                              aria-label="Bajar"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Formulario */}
          <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {draft.id ? "Editar sección" : "Nueva sección"}
                </h2>
                {draft.id && (
                  <p className="text-[11px] opacity-70">
                    ID: <code className="font-mono">{draft.id}</code>
                  </p>
                )}
              </div>
              {draft.id && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={remove}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 size={14} className="mr-1" />
                  Eliminar
                </Button>
              )}
            </div>

            {/* Campos comunes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs opacity-70 mb-1">
                  Slug (único)
                </label>
                <Input
                  value={draft.slug}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, slug: e.target.value }))
                  }
                  placeholder="hero-principal, ofertas-hoy…"
                />
                <p className="text-[11px] opacity-60 mt-1">
                  Se usa para identificar la sección. Solo letras, números y
                  guiones.
                </p>
              </div>

              <div>
                <label className="block text-xs opacity-70 mb-1">Tipo</label>
                <select
                  value={draft.type}
                  onChange={(e) => {
                    const nextType = e.target.value as HomeSectionType;
                    setDraft((d) => ({
                      ...EMPTY_DRAFT,
                      id: d.id,
                      slug: d.slug,
                      title: d.title,
                      subtitle: d.subtitle,
                      active: d.active,
                      type: nextType,
                    }));
                  }}
                  className="w-full rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-2 text-sm"
                >
                  {SECTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs opacity-70 mb-1">Título</label>
                <Input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder="Ej: Destacados de hoy"
                />
              </div>

              <div>
                <label className="block text-xs opacity-70 mb-1">
                  Subtítulo (opcional)
                </label>
                <Input
                  value={draft.subtitle}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, subtitle: e.target.value }))
                  }
                  placeholder="Texto descriptivo corto…"
                />
              </div>

              <div className="flex items-center gap-2 mt-1">
                <Switch
                  checked={draft.active}
                  onChange={(val) => setDraft((d) => ({ ...d, active: !!val }))}
                />
                <span className="text-xs">
                  {draft.active
                    ? "Visible en el inicio"
                    : "Oculta en el inicio"}
                </span>
              </div>
            </div>

            {/* Campos específicos */}
            <div className="border-t border-[rgb(var(--border-rgb))] pt-4 space-y-3">
              {renderTypeFields()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                onClick={save}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {(createMut.isPending || updateMut.isPending) && (
                  <span className="mr-2">
                    <Spinner size={16} />
                  </span>
                )}
                <Save size={16} className="mr-1" />
                {draft.id ? "Guardar cambios" : "Crear sección"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Selección / aplicación de plantilla */}
      <Modal
        open={templateModalOpen && !!templateToApply}
        onClose={closeTemplateModal}
        title="Aplicar plantilla al inicio"
        wide
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={closeTemplateModal}
              disabled={applyTemplateMut.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmApplyTemplate}
              disabled={applyTemplateMut.isPending}
            >
              {applyTemplateMut.isPending && (
                <span className="mr-2">
                  <Spinner size={16} />
                </span>
              )}
              <Sparkles size={16} className="mr-1" />
              Aplicar plantilla
            </Button>
          </div>
        }
      >
        {templateToApply && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide opacity-70">
                Plantilla seleccionada
              </p>
              <h2 className="text-base font-semibold">
                {templateToApply.name}
              </h2>
              {templateToApply.description && (
                <p className="text-xs opacity-80">
                  {templateToApply.description}
                </p>
              )}
              <p className="text-[11px] opacity-80 mt-1">
                Esto reemplazará todas las secciones actuales del inicio por
                esta plantilla. Tus cambios anteriores se perderán para la
                página de inicio.
              </p>
            </div>

            {/* Campo para imagen de fondo del HERO */}
            {templateToApply.sections.some((s) => s.type === "HERO") && (
              <div className="space-y-2">
                <Label>Imagen de fondo del hero (opcional)</Label>
                <div className="space-y-2">
                  <Input
                    value={heroBgUrl}
                    onChange={(e) => setHeroBgUrl(e.target.value)}
                    placeholder="https://tu-imagen-hero.com/portada.jpg"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroImageFileChange}
                      disabled={isUploadingHeroImage}
                      className="block w-full text-[11px] text-[rgb(var(--fg-rgb))]"
                    />
                    {isUploadingHeroImage && <Spinner size={16} />}
                  </div>
                </div>
                <p className="text-[11px] opacity-70">
                  Puedes pegar una URL de imagen o subir un archivo desde tu
                  equipo. Si lo dejas vacío, podrás configurar la imagen luego
                  editando la sección “HERO principal”.
                </p>
                {heroBgUrl && (
                  <div className="mt-2 rounded-xl border border-[rgb(var(--line-rgb))] overflow-hidden">
                    <div className="h-40 w-full bg-[rgb(var(--muted-rgb))]">
                      {/* solo preview visual */}
                      <img
                        src={heroBgUrl}
                        alt="Vista previa hero"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="px-3 py-2 text-[11px] opacity-70">
                      Vista previa aproximada de la imagen del hero.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vista previa dentro del modal */}
            <div className="border-t border-[rgb(var(--line-rgb))] pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium flex items-center gap-1">
                  <Eye size={14} />
                  Vista previa del inicio con esta plantilla
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPreviewInModal((prev) => !prev)}
                >
                  {showPreviewInModal ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {showPreviewInModal && (
                <div className="mt-1 rounded-2xl border border-[rgb(var(--line-rgb))] bg-[rgb(var(--bg-rgb))] p-3 max-h-[420px] overflow-y-auto">
                  <HomeTemplatePreview template={templateToApply} />
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* =========================
   Vista previa de plantillas (solo frontend)
   ========================= */

function HomeTemplatePreview({ template }: { template: TemplateDefinition }) {
  return (
    <div className="space-y-4">
      {template.sections.map((section) => (
        <PreviewSection key={section.slug} section={section} />
      ))}
    </div>
  );
}

function PreviewSection({ section }: { section: TemplateSectionSeed }) {
  const cfg = section.config || {};
  const layout = section.layout || {};
  const typeLabel =
    SECTION_TYPES.find((t) => t.value === section.type)?.label || section.type;

  if (section.type === "HERO") {
    const align: TextAlign = (layout.align as TextAlign) ?? "left";
    const alignCls =
      align === "center"
        ? "items-center text-center md:text-left md:items-start"
        : align === "right"
        ? "items-end text-right md:text-left md:items-start"
        : "items-start text-left";

    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-cyan-500/10 p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
        <div className={`flex-1 flex flex-col gap-2 ${alignCls}`}>
          <span className="text-[10px] uppercase tracking-wide text-emerald-400">
            {typeLabel}
          </span>
          <h3 className="text-base md:text-xl font-semibold">
            {section.title}
          </h3>
          {section.subtitle && (
            <p className="text-xs md:text-sm opacity-80">{section.subtitle}</p>
          )}
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-1">
            <span className="inline-flex items-center rounded-full bg-emerald-500 text-[10px] md:text-xs px-3 py-1 text-[rgb(var(--bg-rgb))]">
              Botón principal
            </span>
            {cfg.showSearch && (
              <span className="inline-flex items-center rounded-full border border-emerald-400/50 text-[10px] md:text-xs px-3 py-1 text-emerald-200/90 bg-emerald-500/10">
                Barra de búsqueda
              </span>
            )}
          </div>
        </div>
        <div className="w-full md:w-64 h-28 md:h-36 rounded-xl border border-dashed border-emerald-400/50 bg-[rgb(var(--card-rgb))] flex items-center justify-center text-[10px] md:text-xs opacity-70">
          Imagen destacada / producto
        </div>
      </div>
    );
  }

  if (section.type === "PRODUCT_GRID") {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 md:p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase tracking-wide opacity-60">
              {typeLabel}
            </span>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            {section.subtitle && (
              <p className="text-[11px] opacity-70">{section.subtitle}</p>
            )}
          </div>
          <span className="text-[10px] opacity-60">
            Modo: {cfg.mode ?? "LATEST"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--bg-rgb))] p-2 flex flex-col gap-1"
            >
              <div className="h-16 md:h-20 rounded-lg bg-[rgb(var(--card-2-rgb))]" />
              <div className="h-2 rounded bg-[rgb(var(--border-rgb))]" />
              <div className="h-2 w-2/3 rounded bg-[rgb(var(--border-rgb))]" />
              <div className="mt-1 flex items-center justify-between">
                <div className="h-2 w-10 rounded bg-[rgb(var(--border-rgb))]" />
                <div className="h-5 w-5 rounded-full border border-[rgb(var(--border-rgb))]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === "PRODUCT_STRIP") {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase tracking-wide opacity-60">
              {typeLabel}
            </span>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            {section.subtitle && (
              <p className="text-[11px] opacity-70">{section.subtitle}</p>
            )}
          </div>
          <span className="text-[10px] opacity-60">
            Modo: {cfg.mode ?? "BEST_SELLERS"}
          </span>
        </div>
        <div className="mt-2 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[120px] rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--bg-rgb))] p-2 flex flex-col gap-1"
            >
              <div className="h-14 rounded-lg bg-[rgb(var(--card-2-rgb))]" />
              <div className="h-2 rounded bg-[rgb(var(--border-rgb))]" />
              <div className="h-2 w-2/3 rounded bg-[rgb(var(--border-rgb))]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section.type === "CATEGORY_STRIP") {
    return (
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] uppercase tracking-wide opacity-60">
              {typeLabel}
            </span>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            {section.subtitle && (
              <p className="text-[11px] opacity-70">{section.subtitle}</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Electrónica", "Hogar", "Moda", "Ofertas", "Ver todo"].map(
            (c, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full border border-[rgb(var(--border-rgb))] bg-[rgb(var(--bg-rgb))] text-[11px]"
              >
                {c}
              </span>
            )
          )}
        </div>
      </div>
    );
  }

  if (section.type === "BANNER") {
    const tone: BannerTone = (layout.tone as BannerTone) ?? "soft";
    const toneCls =
      tone === "dark"
        ? "bg-zinc-900/80 border-zinc-700 text-zinc-50"
        : tone === "brand"
        ? "bg-emerald-500/12 border-emerald-500/40 text-[rgb(var(--fg-rgb))]"
        : "bg-emerald-500/8 border-emerald-500/30 text-[rgb(var(--fg-rgb))]";

    return (
      <div
        className={`rounded-2xl border px-3 py-3 md:px-4 md:py-3 flex flex-col md:flex-row items-center justify-between gap-3 ${toneCls}`}
      >
        <div>
          <span className="text-[10px] uppercase tracking-wide opacity-70">
            {typeLabel}
          </span>
          <h3 className="text-sm font-semibold">{section.title}</h3>
          {section.subtitle && (
            <p className="text-[11px] opacity-80">{section.subtitle}</p>
          )}
        </div>
        {cfg.ctaLabel && (
          <span className="inline-flex items-center rounded-full bg-emerald-500 text-[10px] md:text-xs px-3 py-1 text-[rgb(var(--bg-rgb))]">
            {cfg.ctaLabel}
          </span>
        )}
      </div>
    );
  }

  // TEXT_BLOCK u otros
  return (
    <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 space-y-1">
      <span className="text-[10px] uppercase tracking-wide opacity-60">
        {typeLabel}
      </span>
      <h3 className="text-sm font-semibold">{section.title}</h3>
      {section.subtitle && (
        <p className="text-[11px] opacity-75">{section.subtitle}</p>
      )}
    </div>
  );
}
