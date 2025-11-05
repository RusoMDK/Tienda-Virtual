// src/features/home/types.ts

// Debe cuadrar con lo que usamos en admin + backend
export type HomeSectionType =
  | "HERO"
  | "PRODUCT_GRID"
  | "PRODUCT_STRIP"
  | "CATEGORY_STRIP"
  | "BANNER"
  | "TEXT_BLOCK";

export type HomeProductSummary = {
  id: string;
  slug: string;
  name: string;
  price: number; // en centavos
  currency: string; // "usd", "eur", etc.
  imageUrl: string | null;
  categoryName: string | null;
};

export type HomeSection = {
  id: string;
  slug: string;
  type: HomeSectionType;
  title: string | null;
  subtitle: string | null;
  config: any;
  layout: any;
  active: boolean;
  position: number;
  products?: HomeProductSummary[];
};
