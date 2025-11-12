import { useEffect, useMemo, useState, useRef } from "react";
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

type HeroVariant = "single" | "carousel";

type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
};

const createSlideId = () => `slide_${Math.random().toString(36).slice(2, 9)}`;

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
  { value: "HERO", label: "Cabecera de inicio (banner grande)" },
  { value: "PRODUCT_GRID", label: "Bloque de productos (cuadrícula)" },
  {
    value: "PRODUCT_STRIP",
    label: "Fila de productos (scroll horizontal)",
  },
  { value: "CATEGORY_STRIP", label: "Fila / carrusel de categorías" },
  { value: "BANNER", label: "Mensaje destacado / banner" },
  { value: "TEXT_BLOCK", label: "Bloque de texto informativo" },
];

type Draft = {
  id?: string;
  slug: string;
  type: HomeSectionType;
  title: string;
  subtitle: string;
  active: boolean;

  // CABECERA / HERO
  heroCtaLabel: string;
  heroCtaHref: string;
  heroShowSearch: boolean;
  heroBackgroundUrl: string;
  heroVariant: HeroVariant;
  heroSlides: HeroSlide[];
  heroOverlapNext: boolean;

  // PRODUCT GRID / STRIP
  prodMode: ProductMode;
  prodCategorySlug: string;
  prodLimit: number;
  prodLayoutVariant: ProductLayoutVariant;
  prodLayoutStyle: "panel" | "floating-panel";
  prodCardShape: "square" | "portrait";
  prodDensity: "compact" | "comfortable";
  prodRailStyle: "tight" | "default";
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
  heroVariant: "single",
  heroSlides: [],
  heroOverlapNext: false,

  prodMode: "LATEST",
  prodCategorySlug: "",
  prodLimit: 8,
  prodLayoutVariant: "grid-3",
  prodLayoutStyle: "panel",
  prodCardShape: "portrait",
  prodDensity: "comfortable",
  prodRailStyle: "default",
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

  const cfg: any = (section as any).config ?? {};
  const layout: any = (section as any).layout ?? {};

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
      const slidesCfg = Array.isArray(cfg.slides) ? cfg.slides : [];
      const slides: HeroSlide[] = slidesCfg.map((s: any, index: number) => ({
        id: s.id || `${section.id}-slide-${index}`,
        title: s.title ?? section.title ?? "",
        subtitle: s.subtitle ?? section.subtitle ?? "",
        imageUrl:
          s.imageUrl ||
          s.backgroundImageUrl ||
          s.image?.url ||
          cfg.backgroundImageUrl ||
          "",
        ctaLabel: s.ctaLabel ?? cfg.ctaLabel ?? "Ver catálogo",
        ctaHref: s.ctaHref ?? cfg.ctaHref ?? "/tienda",
      }));

      const hasCarousel = slides.length > 0;

      return {
        ...base,
        heroCtaLabel: cfg.ctaLabel ?? "Ver catálogo",
        heroCtaHref: cfg.ctaHref ?? "/tienda",
        heroShowSearch: cfg.showSearch ?? true,
        heroBackgroundUrl:
          cfg.backgroundImage?.url ?? cfg.backgroundImageUrl ?? "",
        heroVariant: hasCarousel ? "carousel" : "single",
        heroSlides: slides,
        heroOverlapNext: !!layout.overlapNext,
      };
    }

    case "PRODUCT_GRID":
    case "PRODUCT_STRIP": {
      const isGrid = section.type === "PRODUCT_GRID";
      const isStrip = section.type === "PRODUCT_STRIP";

      return {
        ...base,
        prodMode: (cfg.mode as ProductMode) ?? "LATEST",
        prodCategorySlug: cfg.categorySlug ?? "",
        prodLimit: typeof cfg.limit === "number" ? cfg.limit : 8,
        prodLayoutVariant:
          (layout.variant as ProductLayoutVariant) ??
          (isGrid ? "grid-3" : "strip-md"),
        prodLayoutStyle:
          (layout.style as "panel" | "floating-panel") ?? "panel",
        prodCardShape:
          (layout.cardShape as "square" | "portrait") ??
          (isGrid ? "square" : "portrait"),
        prodDensity:
          (layout.density as "compact" | "comfortable") ?? "comfortable",
        prodRailStyle:
          (layout.railStyle as "tight" | "default") ??
          (isStrip ? "tight" : "default"),
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
      const baseCfg = {
        mode: "STATIC",
        ctaLabel: draft.heroCtaLabel || "Ver catálogo",
        ctaHref: draft.heroCtaHref || "/tienda",
        showSearch: draft.heroShowSearch,
        backgroundImageUrl: draft.heroBackgroundUrl || null,
      };

      if (draft.heroVariant === "carousel" && draft.heroSlides.length) {
        config = {
          ...baseCfg,
          mode: "CAROUSEL",
          slides: draft.heroSlides.map((s) => ({
            id: s.id,
            title: s.title,
            subtitle: s.subtitle,
            imageUrl: s.imageUrl,
            ctaLabel: s.ctaLabel || baseCfg.ctaLabel,
            ctaHref: s.ctaHref || baseCfg.ctaHref,
          })),
        };
      } else {
        config = baseCfg;
      }

      layout = {
        kind: "hero",
        align: "left",
        width: "full-bleed",
        bottomFade: "auto-theme",
        overlapNext: draft.heroOverlapNext || undefined,
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

      if (draft.type === "PRODUCT_GRID") {
        layout.style = draft.prodLayoutStyle;
        layout.cardShape = draft.prodCardShape;
        layout.density = draft.prodDensity;
      } else if (draft.type === "PRODUCT_STRIP") {
        layout.railStyle = draft.prodRailStyle;
      }
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

  // Refs para inputs de archivo
  const heroTemplateFileInputRef = useRef<HTMLInputElement | null>(null);
  const heroBgFileInputRef = useRef<HTMLInputElement | null>(null);
  const heroCarouselFileInputRef = useRef<HTMLInputElement | null>(null);

  // Subida imagen de cabecera desde el formulario
  const [isUploadingHeroBackground, setIsUploadingHeroBackground] =
    useState(false);

  // Subida imagen por slide
  const [heroSlideUploadingId, setHeroSlideUploadingId] = useState<
    string | null
  >(null);

  // Imágenes para carrusel desde el modal de plantilla
  const [heroCarouselUrls, setHeroCarouselUrls] = useState<string[]>([]);
  const [isUploadingHeroCarousel, setIsUploadingHeroCarousel] = useState(false);

  // ¿La plantilla seleccionada ya define un HERO tipo carrusel?
  const heroTemplateHasCarousel = useMemo(() => {
    if (!templateToApply) return false;
    return templateToApply.sections.some((s) => {
      if (s.type !== "HERO") return false;
      const cfg: any = s.config || {};
      return (
        cfg.mode === "CAROUSEL" ||
        (Array.isArray(cfg.slides) && cfg.slides.length > 1)
      );
    });
  }, [templateToApply]);

  useEffect(() => {
    if (data) {
      setSections(data);
      if (!selectedId && data.length) {
        selectSection(data[0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Bloquear scroll del fondo cuando el modal está abierto
  useEffect(() => {
    if (!templateModalOpen) return;
    if (typeof document === "undefined") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [templateModalOpen]);

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
    const hero = tpl.sections.find((s) => s.type === "HERO") as any;
    const existingBg =
      hero?.config?.backgroundImage?.url ||
      hero?.config?.backgroundImageUrl ||
      "";
    setHeroBgUrl(existingBg || "");
    setHeroCarouselUrls([]);
    setShowPreviewInModal(true);
    setTemplateModalOpen(true);
  }

  function closeTemplateModal() {
    if (applyTemplateMut.isPending) return;
    setTemplateModalOpen(false);
    setTimeout(() => {
      setTemplateToApply(null);
      setHeroBgUrl("");
      setHeroCarouselUrls([]);
    }, 180);
  }

  // Uploader Cloudinary para la imagen de cabecera del modal (plantilla)
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
        description: "Usaremos esta imagen como fondo de la cabecera.",
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

  // Uploader Cloudinary para la imagen de cabecera en el formulario HERO
  async function handleHeroBackgroundFileChange(e: any) {
    const file = e.target?.files?.[0];
    if (!file) return;

    try {
      setIsUploadingHeroBackground(true);

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

      setDraft((d) => ({
        ...d,
        heroBackgroundUrl: url,
      }));

      notify({
        title: "Imagen subida",
        description: "Usaremos esta imagen como fondo de la cabecera.",
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
      setIsUploadingHeroBackground(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  // Uploader Cloudinary por slide del carrusel (formulario HERO)
  async function handleHeroSlideFileChange(slideId: string, e: any) {
    const file = e.target?.files?.[0];
    if (!file) return;

    try {
      setHeroSlideUploadingId(slideId);

      const { url } = await uploadToCloudinary(file, {
        alias: "root",
        folder: "home/hero-slides",
        resourceType: "image",
        maxBytes: 8 * 1024 * 1024,
        acceptMime: ["image/jpeg", "image/png", "image/webp"],
        onProgress: () => {},
      });

      if (!url) {
        throw new Error("La subida a Cloudinary no devolvió una URL.");
      }

      setDraft((d) => ({
        ...d,
        heroSlides: d.heroSlides.map((s) =>
          s.id === slideId ? { ...s, imageUrl: url } : s
        ),
      }));

      notify({
        title: "Imagen subida",
        description: "La slide del carrusel se actualizó correctamente.",
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
      setHeroSlideUploadingId(null);
      if (e.target) {
        e.target.value = "";
      }
    }
  }

  // Uploader Cloudinary para las imágenes del carrusel desde el modal de plantilla
  async function handleHeroCarouselFilesChange(e: any) {
    const files: FileList | undefined = e.target?.files;
    if (!files || !files.length) return;

    try {
      setIsUploadingHeroCarousel(true);

      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const { url } = await uploadToCloudinary(file, {
          alias: "root",
          folder: "home/hero-slides",
          resourceType: "image",
          maxBytes: 8 * 1024 * 1024,
          acceptMime: ["image/jpeg", "image/png", "image/webp"],
          onProgress: () => {},
        });
        if (url) newUrls.push(url);
      }

      if (!newUrls.length) {
        throw new Error("La subida a Cloudinary no devolvió URLs válidas.");
      }

      setHeroCarouselUrls((prev) => [...prev, ...newUrls]);

      notify({
        title: "Imágenes subidas",
        description:
          "Crearemos un carrusel en la cabecera usando estas imágenes.",
        variant: "success",
      });
    } catch (err: any) {
      console.error(err);
      notify({
        title: "Error al subir las imágenes",
        description:
          err?.message || "No se pudieron subir las imágenes a Cloudinary.",
        variant: "error",
      });
    } finally {
      setIsUploadingHeroCarousel(false);
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
      heroCarouselUrls: string[];
      existingSections: HomeSection[];
    }) => {
      const {
        template,
        heroBackgroundUrl,
        heroCarouselUrls,
        existingSections,
      } = input;

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
        const baseCfg: any = seed.config || {};
        let cfg: any = { ...baseCfg };

        if (seed.type === "HERO") {
          // Imagen base de fondo
          if (heroBackgroundUrl) {
            cfg.backgroundImageUrl = heroBackgroundUrl;
          }

          // Si hay imágenes para carrusel, forzamos modo CAROUSEL y generamos slides
          if (heroCarouselUrls && heroCarouselUrls.length > 0) {
            const ctaLabel = cfg.ctaLabel || "Ver catálogo";
            const ctaHref = cfg.ctaHref || "/tienda";

            cfg.mode = "CAROUSEL";
            cfg.slides = heroCarouselUrls.map((url, index) => ({
              id: `tpl-hero-slide-${index + 1}`,
              title: seed.title || `Slide ${index + 1}`,
              subtitle: seed.subtitle || "",
              imageUrl: url,
              ctaLabel,
              ctaHref,
            }));
          }
        }

        let layout: any = seed.layout || {};
        if (seed.type === "HERO") {
          layout = {
            ...layout,
            width: "full-bleed",
            bottomFade: "auto-theme",
            align: layout.align || "left",
            overlapNext:
              typeof layout.overlapNext === "boolean"
                ? layout.overlapNext
                : true,
          };
        }

        await adminCreateHomeSection({
          slug: seed.slug,
          type: seed.type,
          title: seed.title,
          subtitle: seed.subtitle ?? null,
          active: seed.active ?? true,
          config: cfg,
          layout,
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
      setHeroCarouselUrls([]);
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
      heroCarouselUrls,
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
        <div className="space-y-4">
          {/* Tipo de cabecera */}
          <div>
            <label className="block text-xs opacity-70 mb-1">
              Tipo de cabecera de inicio
            </label>
            <div className="inline-flex rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] p-1 text-xs">
              {[
                { value: "single", label: "Imagen única" },
                { value: "carousel", label: "Carrusel de imágenes" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      heroVariant: opt.value as HeroVariant,
                    }))
                  }
                  className={[
                    "px-3 py-1 rounded-lg transition-colors",
                    draft.heroVariant === opt.value
                      ? "bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))]"
                      : "hover:bg-[rgb(var(--muted-rgb))]/70",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] opacity-60 mt-1">
              El carrusel te permite rotar varias promos en la cabecera, como
              hacen tiendas tipo Amazon.
            </p>
          </div>

          {/* CTA global + enlace */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">
                Texto del botón principal
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
                Enlace del botón principal
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

          {/* Toggles de búsqueda + overlap */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={draft.heroShowSearch}
                onChange={(val) =>
                  setDraft((d) => ({ ...d, heroShowSearch: !!val }))
                }
              />
              Mostrar buscador debajo de la cabecera
            </label>

            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={draft.heroOverlapNext}
                onChange={(val) =>
                  setDraft((d) => ({ ...d, heroOverlapNext: !!val }))
                }
              />
              Superponer la siguiente sección sobre la cabecera{" "}
              <span className="opacity-60">
                (el grid “tapa” un poco el carrusel)
              </span>
            </label>
          </div>

          {/* Imagen de fondo cabecera */}
          <div className="space-y-2">
            <label className="block text-xs opacity-70 mb-1">
              Imagen de fondo de la cabecera
            </label>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  value={draft.heroBackgroundUrl}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      heroBackgroundUrl: e.target.value,
                    }))
                  }
                  placeholder="https://…"
                />
                <p className="text-[11px] opacity-60 mt-1">
                  Puedes pegar un enlace o subir una imagen. Se usa como fondo
                  en la cabecera simple y como respaldo si alguna slide no tiene
                  imagen.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1 md:mt-0">
                <input
                  ref={heroBgFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleHeroBackgroundFileChange}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => heroBgFileInputRef.current?.click()}
                  disabled={isUploadingHeroBackground}
                >
                  {isUploadingHeroBackground && (
                    <Spinner size={14} className="mr-1" />
                  )}
                  Subir imagen
                </Button>
              </div>
            </div>
            {draft.heroBackgroundUrl && (
              <div className="mt-2 rounded-xl border border-[rgb(var(--border-rgb))] overflow-hidden h-32">
                <img
                  src={draft.heroBackgroundUrl}
                  alt="Fondo cabecera"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Editor de slides cuando es carrusel */}
          {draft.heroVariant === "carousel" && (
            <div className="border border-[rgb(var(--border-rgb))] rounded-xl p-3 space-y-3 bg-[rgb(var(--card-2-rgb))]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  Slides del carrusel de cabecera
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      heroSlides: [
                        ...d.heroSlides,
                        {
                          id: createSlideId(),
                          title: d.title || "Nueva promo",
                          subtitle: d.subtitle || "",
                          imageUrl: d.heroBackgroundUrl || "",
                          ctaLabel: d.heroCtaLabel || "Ver más",
                          ctaHref: d.heroCtaHref || "/tienda",
                        },
                      ],
                    }))
                  }
                >
                  <Plus size={12} className="mr-1" />
                  Añadir slide
                </Button>
              </div>

              {draft.heroSlides.length === 0 && (
                <p className="text-[11px] opacity-70">
                  Añade 2–5 slides con distintas promos, imágenes y botones.
                </p>
              )}

              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {draft.heroSlides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className="rounded-lg border border-[rgb(var(--border-rgb))] bg-[rgb(var(--bg-rgb))] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        Slide {index + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-[rgb(var(--muted-rgb))] disabled:opacity-40"
                          disabled={index === 0}
                          onClick={() =>
                            setDraft((d) => {
                              const arr = [...d.heroSlides];
                              const [item] = arr.splice(index, 1);
                              arr.splice(index - 1, 0, item);
                              return { ...d, heroSlides: arr };
                            })
                          }
                          aria-label="Subir slide"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-[rgb(var(--muted-rgb))] disabled:opacity-40"
                          disabled={index === draft.heroSlides.length - 1}
                          onClick={() =>
                            setDraft((d) => {
                              const arr = [...d.heroSlides];
                              const [item] = arr.splice(index, 1);
                              arr.splice(index + 1, 0, item);
                              return { ...d, heroSlides: arr };
                            })
                          }
                          aria-label="Bajar slide"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-red-500/10 text-red-400"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              heroSlides: d.heroSlides.filter(
                                (s) => s.id !== slide.id
                              ),
                            }))
                          }
                          aria-label="Eliminar slide"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] opacity-70 mb-0.5">
                          Título
                        </label>
                        <Input
                          value={slide.title}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              heroSlides: d.heroSlides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, title: e.target.value }
                                  : s
                              ),
                            }))
                          }
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-70 mb-0.5">
                          Subtítulo
                        </label>
                        <Input
                          value={slide.subtitle}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              heroSlides: d.heroSlides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, subtitle: e.target.value }
                                  : s
                              ),
                            }))
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] opacity-70 mb-0.5">
                        Imagen (URL)
                      </label>
                      <Input
                        value={slide.imageUrl}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            heroSlides: d.heroSlides.map((s) =>
                              s.id === slide.id
                                ? { ...s, imageUrl: e.target.value }
                                : s
                            ),
                          }))
                        }
                        placeholder="https://…"
                        className="text-xs"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          id={`slide-upload-${slide.id}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleHeroSlideFileChange(slide.id, e)
                          }
                        />
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            document
                              .getElementById(`slide-upload-${slide.id}`)
                              ?.click()
                          }
                          disabled={heroSlideUploadingId === slide.id}
                        >
                          {heroSlideUploadingId === slide.id && (
                            <Spinner size={12} className="mr-1" />
                          )}
                          Subir imagen
                        </Button>
                      </div>
                      {slide.imageUrl && (
                        <div className="mt-1 rounded-lg border border-[rgb(var(--border-rgb))] overflow-hidden h-20">
                          <img
                            src={slide.imageUrl}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] opacity-70 mb-0.5">
                          Texto botón
                        </label>
                        <Input
                          value={slide.ctaLabel}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              heroSlides: d.heroSlides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, ctaLabel: e.target.value }
                                  : s
                              ),
                            }))
                          }
                          placeholder={draft.heroCtaLabel || "Ver más"}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] opacity-70 mb-0.5">
                          Enlace botón
                        </label>
                        <Input
                          value={slide.ctaHref}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              heroSlides: d.heroSlides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, ctaHref: e.target.value }
                                  : s
                              ),
                            }))
                          }
                          placeholder={draft.heroCtaHref || "/tienda"}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (type === "PRODUCT_GRID" || type === "PRODUCT_STRIP") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs opacity-70 mb-1">
                ¿Qué productos mostrar?
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
                Diseño de las tarjetas
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
                    <option value="strip-sm">Fila compacta</option>
                    <option value="strip-md">Fila mediana</option>
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
          </div>
        </div>
      );
    }

    if (type === "CATEGORY_STRIP") {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs opacity-70 mb-1">
              Categorías en la fila / carrusel
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
                  Usa una plantilla de arriba o crea una sección de{" "}
                  <strong>cabecera de inicio</strong> para empezar.
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
                      {/* CAMBIO: div con role="button" para evitar button dentro de button */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => selectSection(s)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectSection(s);
                          }
                        }}
                        className={[
                          "w-full flex items-center gap-2 rounded-xl border px-2 py-2 text-left text-xs transition cursor-pointer",
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
                      </div>
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
                  placeholder="cabecera-inicio, ofertas-hoy…"
                />
                <p className="text-[11px] opacity-60 mt-1">
                  Se usa para identificar la sección. Solo letras, números y
                  guiones.
                </p>
              </div>

              <div>
                <label className="block text-xs opacity-70 mb-1">
                  Tipo de bloque
                </label>
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
                <label className="block text-xs opacity-70 mb-1">
                  Título visible
                </label>
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
                    ? "Visible en la página de inicio"
                    : "Oculta en la página de inicio"}
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

            {/* Campo para imagen de fondo de la cabecera */}
            {templateToApply.sections.some((s) => s.type === "HERO") && (
              <div className="space-y-2">
                <Label>Imagen de fondo de la cabecera (opcional)</Label>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <Input
                    value={heroBgUrl}
                    onChange={(e) => setHeroBgUrl(e.target.value)}
                    placeholder="https://tu-imagen-hero.com/portada.jpg"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={heroTemplateFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleHeroImageFileChange}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => heroTemplateFileInputRef.current?.click()}
                      disabled={isUploadingHeroImage}
                    >
                      {isUploadingHeroImage && (
                        <Spinner size={14} className="mr-1" />
                      )}
                      Subir imagen
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] opacity-70">
                  Puedes pegar una URL de imagen o subir un archivo desde tu
                  equipo. Si lo dejas vacío, podrás configurar la imagen luego
                  editando la sección de cabecera de inicio.
                </p>
                {heroBgUrl && (
                  <div className="mt-2 rounded-xl border border-[rgb(var(--line-rgb))] overflow-hidden">
                    <div className="h-40 w-full bg-[rgb(var(--muted-rgb))]">
                      <img
                        src={heroBgUrl}
                        alt="Vista previa cabecera"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="px-3 py-2 text-[11px] opacity-70">
                      Vista previa aproximada de la imagen de la cabecera.
                    </div>
                  </div>
                )}

                {/* Imágenes para carrusel (si quieres que salga ya como carrusel) */}
                <div className="mt-3 space-y-2">
                  <Label>
                    Imágenes para el carrusel de cabecera (opcional)
                  </Label>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <input
                      ref={heroCarouselFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleHeroCarouselFilesChange}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => heroCarouselFileInputRef.current?.click()}
                      disabled={isUploadingHeroCarousel}
                    >
                      {isUploadingHeroCarousel && (
                        <Spinner size={14} className="mr-1" />
                      )}
                      Subir imágenes
                    </Button>
                    {!!heroCarouselUrls.length && (
                      <span className="text-[11px] opacity-70">
                        {heroCarouselUrls.length} imagen
                        {heroCarouselUrls.length > 1
                          ? "es seleccionadas"
                          : " seleccionada"}
                      </span>
                    )}
                  </div>

                  {!!heroCarouselUrls.length && (
                    <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                      {heroCarouselUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="relative h-16 w-24 rounded-lg overflow-hidden border border-[rgb(var(--line-rgb))]"
                        >
                          <img
                            src={url}
                            alt={`Slide ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] opacity-70">
                    Si añades varias imágenes, crearemos automáticamente un
                    carrusel en la cabecera usando estas imágenes como slides.
                    Después, en “Cabecera de inicio”, podrás ajustar títulos y
                    enlaces de cada slide.
                  </p>
                  {heroTemplateHasCarousel && (
                    <p className="text-[11px] opacity-60">
                      La plantilla ya define un carrusel; estas imágenes
                      reemplazarán las de las slides por defecto.
                    </p>
                  )}
                </div>
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
  const cfg: any = section.config || {};
  const layout: any = section.layout || {};
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

    const hasCarousel =
      Array.isArray(cfg.slides) && (cfg.slides as any[]).length > 1;
    const overlap = !!layout.overlapNext;

    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-cyan-500/10 p-4 md:p-6 flex flex-col gap-4">
        <div className={`flex flex-col gap-2 ${alignCls}`}>
          <span className="text-[10px] uppercase tracking-wide text-emerald-400 flex items-center gap-1">
            {typeLabel}
            {hasCarousel && (
              <span className="px-1.5 py-0.5 rounded-full border border-emerald-400/60 bg-emerald-500/10 text-[9px] normal-case">
                Carrusel
              </span>
            )}
            {overlap && (
              <span className="px-1.5 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/5 text-[9px] normal-case">
                Superpone siguiente sección
              </span>
            )}
          </span>
          <h3 className="text-base md:text-xl font-semibold">
            {section.title}
          </h3>
          {section.subtitle && (
            <p className="text-xs md:text-sm opacity-80">{section.subtitle}</p>
          )}
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-1">
            <span className="inline-flex items-center rounded-full bg-emerald-500 text-[10px] md:text-xs px-3 py-1 text-white">
              Botón principal
            </span>
            {cfg.showSearch && (
              <span className="inline-flex items-center rounded-full border border-emerald-400/50 text-[10px] md:text-xs px-3 py-1 text-emerald-200/90 bg-emerald-500/10">
                Barra de búsqueda
              </span>
            )}
          </div>
        </div>
        <div className="h-20 w-full rounded-xl border border-dashed border-emerald-400/40 bg-[rgb(var(--card-rgb))] flex items-center justify-center text-[10px] md:text-xs opacity-70">
          Imagen de fondo / cabecera
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
        ? "bg-[rgb(var(--primary-rgb))/0.08] border-[rgb(var(--primary-rgb))/0.35]"
        : "bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]";

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
          <span className="inline-flex items-center rounded-full bg-emerald-500 text-[10px] md:text-xs px-3 py-1 text-white">
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
