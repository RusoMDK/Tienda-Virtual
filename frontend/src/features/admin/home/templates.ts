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
 * Plantillas rápidas de inicio
 *
 * Pensadas para comportarse como home de tiendas grandes (Amazon, Best Buy,
 * AliExpress) pero con un diseño limpio y adaptable a tu frontend.
 *
 * Claves para el frontend:
 *
 * HERO:
 *  - config.mode: "STATIC" | "CAROUSEL"
 *  - layout.width: "full-bleed" | "content"
 *  - layout.bottomFade: "auto-theme" | "none"
 *  - layout.overlapNext: true → la siguiente sección se superpone (tipo Amazon)
 *
 * PRODUCT_GRID / PRODUCT_STRIP:
 *  - layout.variant: "grid-2" | "grid-3" | "grid-4" | "strip-sm" | "strip-md"
 *  - layout.style:
 *      - "floating-panel" → panel flotando sobre el hero (margin-top negativo)
 *      - "panel" → panel normal
 *  - layout.cardShape: "square" | "portrait"
 *  - layout.density: "compact" | "comfortable"
 *  - layout.railStyle (STRIP):
 *      - "tight" | "default"
 */

export const HOME_TEMPLATES: TemplateDefinition[] = [
  /**
   * INICIO TIPO AMAZON · CARRUSEL + PANELES
   */
  {
    id: "amazon-style-home-v1",
    name: "Inicio tipo Amazon · carrusel + paneles",
    description:
      "Cabecera tipo carrusel a ancho completo, con panel de productos flotante y más secciones dinámicas debajo.",
    badge: "Recomendada",
    sections: [
      // 1) HERO / cabecera tipo carrusel
      {
        slug: "hero-amazon-like",
        type: "HERO",
        title: "Todo para tu día a día en un solo lugar",
        subtitle:
          "Promociones en alimentos, limpieza, electrodomésticos y más, con envíos rápidos y pagos seguros.",
        active: true,
        config: {
          mode: "CAROUSEL",
          ctaLabel: "Ver ofertas destacadas",
          ctaHref: "/ofertas",
          showSearch: true,
          backgroundImageUrl: "",
          slides: [
            {
              id: "amazon-hero-1",
              title: "Ahorra en tu compra del mes",
              subtitle: "Ofertas especiales en alimentos y bebidas.",
              imageUrl: "",
              ctaLabel: "Ver alimentos",
              ctaHref: "/categorias/alimentos",
            },
            {
              id: "amazon-hero-2",
              title: "Limpieza y cuidado del hogar",
              subtitle: "Combos de limpieza hasta 30% OFF.",
              imageUrl: "",
              ctaLabel: "Ver limpieza",
              ctaHref: "/categorias/aseo-y-limpieza",
            },
            {
              id: "amazon-hero-3",
              title: "Electrodomésticos para tu casa",
              subtitle: "Financiación y envíos a todo el país.",
              imageUrl: "",
              ctaLabel: "Ver electrodomésticos",
              ctaHref: "/categorias/electrodomesticos",
            },
          ],
        },
        layout: {
          kind: "hero",
          align: "left",
          animation: "fade-up",
          surface: "glass",
          emphasis: "primary",
          width: "full-bleed",
          bottomFade: "auto-theme",
          overlapNext: true,
        },
      },

      // 2) Panel flotante de ofertas (grid cuadrado, compacto)
      {
        slug: "panel-ofertas-principales",
        type: "PRODUCT_GRID",
        title: "Ofertas que no te puedes perder",
        subtitle: "Un vistazo rápido a las promos más fuertes de hoy.",
        active: true,
        config: {
          mode: "BEST_SELLERS",
          limit: 8,
        },
        layout: {
          variant: "grid-4",
          showAddToCart: true,
          showRating: true,
          animation: "fade-up",
          style: "floating-panel",
          cardShape: "square",
          density: "compact",
        },
      },

      // 3) Panel por categoría (otro grid, agrupando catálogo)
      {
        slug: "panel-basicos-hogar",
        type: "PRODUCT_GRID",
        title: "Básicos para tu hogar",
        subtitle: "Arma tu hogar con productos esenciales seleccionados.",
        active: true,
        config: {
          mode: "BY_CATEGORY",
          categorySlug: "",
          limit: 8,
        },
        layout: {
          variant: "grid-4",
          showAddToCart: true,
          showRating: false,
          animation: "fade-up",
          style: "panel",
          cardShape: "square",
          density: "compact",
        },
      },

      // 4) Tira horizontal de productos (flash deals)
      {
        slug: "ofertas-relampago",
        type: "PRODUCT_STRIP",
        title: "Ofertas relámpago",
        subtitle:
          "Stock y tiempo limitados. Si te gusta algo, no lo dejes pasar.",
        active: true,
        config: {
          mode: "LATEST",
          limit: 10,
        },
        layout: {
          variant: "strip-md",
          showAddToCart: true,
          showRating: true,
          animation: "slide-left",
          surface: "soft",
          railStyle: "tight",
        },
      },

      // 5) Tira de categorías principales
      {
        slug: "categorias-destacadas",
        type: "CATEGORY_STRIP",
        title: "Explora por categoría",
        subtitle: "Accede directo a las secciones más importantes.",
        active: true,
        config: {
          categories: [],
          level: "PARENT_ONLY",
        },
        layout: {
          variant: "chips",
          animation: "stagger",
          pillStyle: "soft",
        },
      },

      // 6) Banner de confianza / soporte
      {
        slug: "banner-confianza",
        type: "BANNER",
        title: "¿Necesitas ayuda con tu compra?",
        subtitle:
          "Nuestro equipo está listo para ayudarte por chat, mail o teléfono.",
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

  /**
   * OFERTAS Y DESCUENTOS · tipo “deals / daily deals”
   */
  {
    id: "deals-focused-v2",
    name: "Ofertas y descuentos",
    description:
      "Home centrado en descuentos: cabecera de ofertas, flash deals, más vendidos y accesos rápidos a categorías.",
    sections: [
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
          width: "content",
          bottomFade: "none",
        },
      },
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
          surface: "soft",
        },
      },
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
          surface: "soft",
        },
      },
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
          style: "panel",
          cardShape: "portrait",
          density: "comfortable",
        },
      },
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

  /**
   * EXPLORACIÓN POR CATEGORÍAS · tipo marketplace
   */
  {
    id: "category-first-v2",
    name: "Exploración por categorías",
    description:
      "Pensada para tiendas con muchas categorías: primero navegación por categorías y luego listados de productos.",
    sections: [
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
          width: "content",
          bottomFade: "none",
        },
      },
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
          style: "panel",
          cardShape: "portrait",
          density: "comfortable",
        },
      },
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

  /**
   * MINIMAL PREMIUM · tipo tienda de marca
   */
  {
    id: "minimal-premium-v2",
    name: "Minimal premium",
    description:
      "Home limpia para marcas con catálogo curado: cabecera simple, grid de productos, mensaje de marca y categorías elegantes.",
    sections: [
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
          width: "content",
          bottomFade: "none",
        },
      },
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
          style: "panel",
          cardShape: "portrait",
          density: "comfortable",
        },
      },
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
