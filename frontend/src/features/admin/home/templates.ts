// src/features/admin/home/templates.ts
import type { HomeSectionType } from "@/features/home/types";

export type TemplateSectionSeed = {
  slug: string;
  type: HomeSectionType;
  title: string;
  subtitle?: string | null;
  active?: boolean;
  config: any;
  layout: any;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  badge?: string;
  sections: TemplateSectionSeed[];
};

/**
 * Plantillas rápidas de inicio (versión PRO)
 *
 * Patrones pensados para home de marketplaces:
 * - Hero con búsqueda + CTA fuerte
 * - Tiras horizontales de productos (rails) para ofertas / más vendidos
 * - Tira de categorías (SOLO padres, según config.level = "PARENT_ONLY")
 * - Bloques de confianza / beneficios / marca
 *
 * Hints de UI (opcional, para el frontend):
 * - layout.animation: "fade-up" | "fade-in" | "slide-left" | "slide-right" | "stagger"
 * - layout.emphasis: "primary" | "secondary" | "muted"
 * - layout.surface: "solid" | "soft" | "glass"
 * - layout.density: "comfortable" | "compact"
 * - layout.pillStyle (CATEGORY_STRIP): "soft" | "outline" | "solid"
 */
export const HOME_TEMPLATES: TemplateDefinition[] = [
  {
    id: "marketplace-classic-v2",
    name: "Marketplace clásico optimizado",
    description:
      "Home completo tipo marketplace: hero con búsqueda, beneficios clave, categorías principales, ofertas y grid de novedades.",
    badge: "Recomendada",
    sections: [
      // 1) HERO principal
      {
        slug: "hero-marketplace",
        type: "HERO",
        title: "Todo lo que necesitas, en un solo lugar",
        subtitle:
          "Alimentos, limpieza, electrodomésticos y más con envíos rápidos y pagos seguros.",
        active: true,
        config: {
          mode: "STATIC",
          ctaLabel: "Ver ofertas de hoy",
          ctaHref: "/ofertas",
          showSearch: true,
          backgroundImageUrl: "",
        },
        layout: {
          kind: "hero",
          align: "left",
          animation: "fade-up",
          surface: "glass",
          emphasis: "primary",
        },
      },

      // 2) Beneficios / confianza
      {
        slug: "beneficios-principales",
        type: "TEXT_BLOCK",
        title: "Compra rápido, seguro y sin complicaciones",
        subtitle:
          "Una experiencia pensada para tus compras del día a día y para tus compras grandes.",
        active: true,
        config: {
          text: [
            "• Envíos rápidos en todo el país",
            "• Devoluciones sencillas y sin letra chica",
            "• Pagos seguros con tarjetas y billeteras digitales",
            "• Atención humana para ayudarte a elegir mejor",
          ].join("\n"),
        },
        layout: {
          align: "left",
          animation: "fade-up",
          density: "compact",
        },
      },

      // 3) Tira de categorías principales (SOLO padres, admin las elige)
      {
        slug: "categorias-destacadas",
        type: "CATEGORY_STRIP",
        title: "Explora por categoría",
        subtitle:
          "Accede directo a las secciones más importantes de la tienda.",
        active: true,
        config: {
          // El admin elegirá las categorías concretas desde el panel.
          // Estas deben ser categorías PADRE (Alimentos, Aseo y limpieza, Electrodomésticos, etc.)
          categories: [],
          level: "PARENT_ONLY",
        },
        layout: {
          variant: "chips",
          animation: "stagger",
          pillStyle: "soft",
        },
      },

      // 4) Tira de ofertas / best sellers
      {
        slug: "ofertas-hoy",
        type: "PRODUCT_STRIP",
        title: "Ofertas de hoy",
        subtitle: "Descuentos destacados por tiempo limitado.",
        active: true,
        config: {
          mode: "BEST_SELLERS",
          limit: 10,
        },
        layout: {
          variant: "strip-md",
          showAddToCart: true,
          showRating: true,
          animation: "slide-left",
          surface: "soft",
        },
      },

      // 5) Grid de novedades
      {
        slug: "novedades-grid",
        type: "PRODUCT_GRID",
        title: "Novedades en la tienda",
        subtitle: "Productos recién llegados que vale la pena descubrir.",
        active: true,
        config: {
          mode: "LATEST",
          limit: 8,
        },
        layout: {
          variant: "grid-4",
          showAddToCart: true,
          showRating: false,
          animation: "fade-up",
        },
      },

      // 6) Banner de confianza / soporte
      {
        slug: "banner-confianza",
        type: "BANNER",
        title: "¿Necesitas ayuda con tu compra?",
        subtitle:
          "Nuestro equipo de soporte está listo para ayudarte en todo momento.",
        active: true,
        config: {
          ctaLabel: "Hablar con soporte",
          ctaHref: "/contacto",
        },
        layout: {
          tone: "soft",
          animation: "fade-in",
        },
      },
    ],
  },

  {
    id: "deals-focused-v2",
    name: "Ofertas y descubrimiento",
    description:
      "Home muy orientado a descuentos: hero de ofertas, flash deals, best sellers y accesos rápidos a categorías.",
    sections: [
      // 1) HERO orientado a ofertas
      {
        slug: "hero-ofertas",
        type: "HERO",
        title: "Ofertas del día y descuentos exclusivos",
        subtitle:
          "Aprovecha precios especiales antes de que se agoten. Nuevas promociones todos los días.",
        active: true,
        config: {
          mode: "STATIC",
          ctaLabel: "Ver todas las ofertas",
          ctaHref: "/ofertas",
          showSearch: true,
          backgroundImageUrl: "",
        },
        layout: {
          kind: "hero",
          align: "center",
          animation: "fade-up",
          surface: "solid",
          emphasis: "primary",
        },
      },

      // 2) Tira de flash deals (últimos añadidos limitados)
      {
        slug: "ofertas-relampago",
        type: "PRODUCT_STRIP",
        title: "Ofertas relámpago",
        subtitle:
          "Stock y tiempo limitados. Si te gusta algo, no lo dejes pasar.",
        active: true,
        config: {
          mode: "LATEST",
          limit: 8,
        },
        layout: {
          variant: "strip-md",
          showAddToCart: true,
          showRating: true,
          animation: "slide-left",
        },
      },

      // 3) Tira de más vendidos (refuerza confianza)
      {
        slug: "top-ventas-deals",
        type: "PRODUCT_STRIP",
        title: "Top ventas de la semana",
        subtitle: "Lo que más están comprando otros clientes ahora mismo.",
        active: true,
        config: {
          mode: "BEST_SELLERS",
          limit: 10,
        },
        layout: {
          variant: "strip-sm",
          showAddToCart: true,
          showRating: true,
          animation: "slide-right",
        },
      },

      // 4) Grid de recomendados
      {
        slug: "recomendados-grid",
        type: "PRODUCT_GRID",
        title: "Recomendados para ti",
        subtitle:
          "Selección de productos populares con excelente relación calidad-precio.",
        active: true,
        config: {
          mode: "BEST_SELLERS",
          limit: 9,
        },
        layout: {
          variant: "grid-3",
          showAddToCart: true,
          showRating: true,
          animation: "fade-up",
        },
      },

      // 5) Categorías rápidas (SOLO padres)
      {
        slug: "categorias-rapidas",
        type: "CATEGORY_STRIP",
        title: "Encuentra rápido lo que buscas",
        subtitle: "Accesos directos a las categorías más visitadas.",
        active: true,
        config: {
          categories: [],
          level: "PARENT_ONLY",
        },
        layout: {
          variant: "compact",
          animation: "stagger",
          pillStyle: "outline",
        },
      },

      // 6) Banner con políticas / confianza
      {
        slug: "banner-politicas",
        type: "BANNER",
        title: "Compra segura y sin preocupaciones",
        subtitle:
          "Conoce nuestras políticas de envíos, cambios y devoluciones.",
        active: true,
        config: {
          ctaLabel: "Ver políticas",
          ctaHref: "/legal/terms",
        },
        layout: {
          tone: "dark",
          animation: "fade-in",
        },
      },
    ],
  },

  {
    id: "category-first-v2",
    name: "Exploración por categorías",
    description:
      "Pensada para tiendas con muchas categorías: navegación por categorías primero y luego listados.",
    sections: [
      // 1) HERO centrado en explorar catálogo
      {
        slug: "hero-categorias",
        type: "HERO",
        title: "Explora todo nuestro catálogo por categoría",
        subtitle:
          "Miles de productos organizados en secciones claras para que encuentres rápido lo que necesitas.",
        active: true,
        config: {
          mode: "STATIC",
          ctaLabel: "Ver todas las categorías",
          ctaHref: "/categorias",
          showSearch: true,
          backgroundImageUrl: "",
        },
        layout: {
          kind: "hero",
          align: "left",
          animation: "fade-up",
          surface: "glass",
        },
      },

      // 2) Tira de categorías principales (la estrella de esta plantilla)
      {
        slug: "categorias-hero-strip",
        type: "CATEGORY_STRIP",
        title: "Categorías principales",
        subtitle:
          "Alimentos, Aseo, Electrodomésticos, Hogar, Moda y mucho más.",
        active: true,
        config: {
          categories: [],
          level: "PARENT_ONLY",
        },
        layout: {
          variant: "cards",
          animation: "stagger",
          pillStyle: "solid",
        },
      },

      // 3) Grid de destacados globales
      {
        slug: "destacados-por-categoria",
        type: "PRODUCT_GRID",
        title: "Destacados en todo el catálogo",
        subtitle:
          "Productos representativos para que conozcas lo mejor de cada sección.",
        active: true,
        config: {
          mode: "LATEST",
          limit: 12,
        },
        layout: {
          variant: "grid-3",
          showAddToCart: true,
          showRating: false,
          animation: "fade-up",
        },
      },

      // 4) Tira de más vendidos globales
      {
        slug: "top-ventas-global",
        type: "PRODUCT_STRIP",
        title: "Más vendidos en toda la tienda",
        subtitle: "Los favoritos de nuestros clientes ahora mismo.",
        active: true,
        config: {
          mode: "BEST_SELLERS",
          limit: 10,
        },
        layout: {
          variant: "strip-sm",
          showAddToCart: true,
          showRating: true,
          animation: "slide-left",
        },
      },

      // 5) Banner de envíos / confianza
      {
        slug: "banner-envios",
        type: "BANNER",
        title: "Envíos rápidos y seguimiento en línea",
        subtitle:
          "Sigue tu pedido en todo momento y recibe notificaciones del estado.",
        active: true,
        config: {
          ctaLabel: "Ver opciones de envío",
          ctaHref: "/ayuda/envios",
        },
        layout: {
          tone: "brand",
          animation: "fade-in",
        },
      },
    ],
  },

  {
    id: "minimal-premium-v2",
    name: "Minimal premium",
    description:
      "Home limpio para marcas con catálogo curado: hero simple, grid potente, mensaje de marca y categorías elegantes.",
    sections: [
      // 1) HERO minimalista y centrado
      {
        slug: "hero-minimal",
        type: "HERO",
        title: "Bienvenido a tu nueva tienda favorita",
        subtitle:
          "Una selección curada de productos pensados para durar y verse bien en tu día a día.",
        active: true,
        config: {
          mode: "STATIC",
          ctaLabel: "Empezar a comprar",
          ctaHref: "/tienda",
          showSearch: true,
          backgroundImageUrl: "",
        },
        layout: {
          kind: "hero",
          align: "center",
          animation: "fade-up",
          surface: "soft",
          emphasis: "primary",
        },
      },

      // 2) Grid principal
      {
        slug: "productos-destacados",
        type: "PRODUCT_GRID",
        title: "Productos destacados",
        subtitle:
          "Nuestra mejor selección para que no tengas que perder tiempo buscando.",
        active: true,
        config: {
          mode: "LATEST",
          limit: 12,
        },
        layout: {
          variant: "grid-3",
          showAddToCart: true,
          showRating: true,
          animation: "fade-up",
        },
      },

      // 3) Tira de categorías sutil (SOLO padres)
      {
        slug: "categorias-minimal",
        type: "CATEGORY_STRIP",
        title: "Explora por categoría",
        subtitle: "Encuentra rápido la colección que mejor encaja contigo.",
        active: true,
        config: {
          categories: [],
          level: "PARENT_ONLY",
        },
        layout: {
          variant: "chips",
          animation: "stagger",
          pillStyle: "outline",
        },
      },

      // 4) Mensaje de marca / storytelling
      {
        slug: "texto-marca",
        type: "TEXT_BLOCK",
        title: "Una experiencia de compra diferente",
        subtitle: null,
        active: true,
        config: {
          text: [
            "Seleccionamos productos con foco en calidad, diseño y durabilidad.",
            "Trabajamos con proveedores confiables y stock real, sin sorpresas.",
            "Te acompañamos antes y después de la compra para que siempre quieras volver.",
          ].join("\n\n"),
        },
        layout: {
          align: "center",
          animation: "fade-up",
          density: "comfortable",
        },
      },

      // 5) Banner de soporte
      {
        slug: "banner-soporte",
        type: "BANNER",
        title: "¿Tienes dudas sobre algún producto?",
        subtitle: "Escríbenos y te ayudamos a elegir la mejor opción para ti.",
        active: true,
        config: {
          ctaLabel: "Contactar soporte",
          ctaHref: "/contacto",
        },
        layout: {
          tone: "soft",
          animation: "fade-in",
        },
      },
    ],
  },
];
