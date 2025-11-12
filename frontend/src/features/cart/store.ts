import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number; // cents
  qty: number; // >= 1
  maxStock?: number; // límite superior (stock actual)
  imageUrl?: string | null; // 👈 nueva: imagen principal del producto
  currency?: string | null; // 👈 nueva: moneda base (ej: "USD")
};

type CartState = {
  items: CartItem[];

  add: (
    item: Partial<CartItem> &
      Pick<CartItem, "productId" | "slug" | "name" | "price">,
    qty?: number
  ) => void;

  setQty: (productId: string, qty: number) => void;

  increment: (productId: string, step?: number) => void;
  decrement: (productId: string, step?: number) => void;

  remove: (productId: string) => void;

  clear: () => void;

  count: () => number;

  subtotalCents: () => number;

  updateMaxStock: (productId: string, maxStock?: number) => void;

  syncMaxStocks: (
    rows: Array<{ productId: string; maxStock?: number }>
  ) => void;
};

const LS_KEY = "cart:v3";
const MAX_QTY = 99;

function clampInt(n: number, min: number, max: number) {
  const x = Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(max, Math.max(min, x));
}

function clampAllowedMaxStock(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  const c = Math.max(0, Math.min(MAX_QTY, Math.round(v)));
  return c; // puede ser 0 (sin stock)
}

function allowedMaxFor(item?: CartItem | null) {
  const s = clampAllowedMaxStock(item?.maxStock);
  return s === undefined ? MAX_QTY : s;
}

function normalizeItem(raw: any): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const productId = String(raw.productId || "").trim();
  const slug = String(raw.slug || "").trim();
  const name = String(raw.name || "").trim();
  const priceNum = Number(raw.price);
  const qtyNum = Number(raw.qty);
  const maxStock = clampAllowedMaxStock(raw.maxStock);
  const imageUrl =
    typeof raw.imageUrl === "string" && raw.imageUrl.trim().length > 0
      ? raw.imageUrl.trim()
      : undefined;
  const currency =
    typeof raw.currency === "string" && raw.currency.trim().length > 0
      ? raw.currency.trim().toUpperCase()
      : undefined;

  if (!productId || !slug || !name) return null;

  // si hay maxStock = 0, no tiene sentido crear el ítem
  if (maxStock === 0) return null;

  const limit = maxStock ?? MAX_QTY;
  const price = Number.isFinite(priceNum)
    ? Math.max(0, Math.round(priceNum))
    : 0;
  const qty = clampInt(qtyNum || 1, 1, limit);

  const base: CartItem = { productId, slug, name, price, qty };
  if (maxStock !== undefined) base.maxStock = maxStock;
  if (imageUrl) base.imageUrl = imageUrl;
  if (currency) base.currency = currency;
  return base;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item, qty) =>
        set((state) => {
          const incomingQty = clampInt(
            Number.isFinite(qty as number)
              ? (qty as number)
              : (item.qty as number) ?? 1,
            1,
            MAX_QTY
          );
          const incomingMax = clampAllowedMaxStock(item.maxStock);

          // ¿ya existe en el carrito?
          const idx = state.items.findIndex(
            (x) => x.productId === item.productId
          );
          if (idx >= 0) {
            const next = [...state.items];
            const current = next[idx];

            const currentLimit = allowedMaxFor(current);
            const incomingLimit = incomingMax ?? currentLimit;
            const limit = Math.min(currentLimit, incomingLimit);

            const nextQty = clampInt(current.qty + incomingQty, 1, limit);

            next[idx] = {
              ...current,
              qty: nextQty,
              maxStock:
                incomingMax !== undefined
                  ? Math.min(limit, incomingMax)
                  : current.maxStock,
              // si nos llega imagen / moneda y antes no había, las guardamos
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : null),
              ...(item.currency ? { currency: item.currency } : null),
            };
            return { items: next };
          }

          // nuevo ítem
          const norm = normalizeItem({
            ...item,
            qty: incomingQty,
            maxStock: incomingMax,
          });
          if (!norm) return state;
          return { items: [...state.items, norm] };
        }),

      setQty: (productId, qty) =>
        set((state) => {
          const next = state.items.map((it) => {
            if (it.productId !== productId) return it;
            const limit = allowedMaxFor(it);
            const q = clampInt(qty, 1, limit);
            return { ...it, qty: q };
          });
          return { items: next.filter((x) => x.qty >= 1) };
        }),

      increment: (productId, step = 1) =>
        set((state) => {
          const next = state.items.map((it) => {
            if (it.productId !== productId) return it;
            const limit = allowedMaxFor(it);
            const q = clampInt(it.qty + step, 1, limit);
            return { ...it, qty: q };
          });
          return { items: next };
        }),

      decrement: (productId, step = 1) =>
        set((state) => {
          const next = state.items
            .map((it) => {
              if (it.productId !== productId) return it;
              const q = clampInt(it.qty - step, 1, MAX_QTY);
              return { ...it, qty: q };
            })
            .filter((x) => x.qty >= 1);
          return { items: next };
        }),

      remove: (productId) =>
        set((state) => ({
          items: state.items.filter((x) => x.productId !== productId),
        })),

      clear: () => set({ items: [] }),

      count: () => get().items.reduce((a, b) => a + (b.qty || 0), 0),

      subtotalCents: () =>
        get().items.reduce(
          (a, b) => a + Math.max(0, Math.round(b.price)) * b.qty,
          0
        ),

      updateMaxStock: (productId, maxStock) =>
        set((state) => {
          const s = clampAllowedMaxStock(maxStock);
          const next = state.items
            .map((it) => {
              if (it.productId !== productId) return it;
              if (s === 0) {
                // sin stock → eliminar
                return { ...it, qty: 0, maxStock: 0 };
              }
              const limit = s ?? it.maxStock ?? MAX_QTY;
              const q = clampInt(it.qty, 1, limit);
              return { ...it, qty: q, maxStock: s ?? it.maxStock };
            })
            .filter((x) => x.qty >= 1);
          return { items: next };
        }),

      syncMaxStocks: (rows) =>
        set((state) => {
          if (!Array.isArray(rows) || rows.length === 0) return state;
          const map = new Map<string, number | undefined>();
          for (const r of rows) {
            map.set(r.productId, clampAllowedMaxStock(r.maxStock));
          }
          const next = state.items
            .map((it) => {
              const s = map.get(it.productId);
              if (s === undefined) return it; // sin cambios
              if (s === 0) return { ...it, qty: 0, maxStock: 0 };
              const limit = s ?? it.maxStock ?? MAX_QTY;
              const q = clampInt(it.qty, 1, limit);
              return { ...it, qty: q, maxStock: s };
            })
            .filter((x) => x.qty >= 1);
          return { items: next };
        }),
    }),
    {
      name: LS_KEY,
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items }),
      migrate: (persisted: any) => {
        const rawItems = Array.isArray(persisted?.items) ? persisted.items : [];
        const items = rawItems
          .map((r) => {
            const norm = normalizeItem(r);
            if (norm && r?.maxStock !== undefined) {
              const s = clampAllowedMaxStock(r.maxStock);
              if (s !== undefined) {
                norm.maxStock = s;
                norm.qty = clampInt(norm.qty, 1, s === 0 ? 1 : s);
                if (s === 0) return null;
              }
            }
            return norm;
          })
          .filter((x): x is CartItem => !!x);
        return { items };
      },
    }
  )
);
