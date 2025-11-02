// src/features/currency/CurrencyProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";

export type CurrencyCode =
  | "USD"
  | "EUR"
  | "MXN"
  | "CAD"
  | "CHF"
  | "CUP"
  | "CLA";

// Monedas seleccionables en la UI (CUP primero)
export const SELECTABLE_CODES: CurrencyCode[] = [
  "CUP",
  "USD",
  "EUR",
  "MXN",
  "CAD",
  "CHF",
  "CLA",
];

type Rates = Partial<Record<CurrencyCode, number>>; // valor = CUP por 1 unidad (X→CUP)

type Ctx = {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: Rates; // p.ej. { USD: 402, EUR: 450, ... , CUP: 1 }
  asOf?: string | null;
  convert: (cents: number, from: CurrencyCode, to: CurrencyCode) => number; // devuelve centavos "to"
  fmt: (cents: number, currency: CurrencyCode) => string;
};

const CurrencyCtx = createContext<Ctx | undefined>(undefined);

const LOCALE_BY_CURR: Record<CurrencyCode, string> = {
  USD: "en-US",
  EUR: "es-ES",
  MXN: "es-MX",
  CAD: "en-CA",
  CHF: "de-CH",
  CUP: "es-CU",
  CLA: "es-ES",
};

/** Normaliza "400.00 CUP" / "1.234,56" / "386,14" → number */
function toNumberLoose(input: unknown): number | null {
  const raw = String(input ?? "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!raw) return null;

  // 1.234,56 → 1234.56 (coma decimal + punto miles)
  if (raw.includes(".") && raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // 123,45 → 123.45 (solo coma)
  if (raw.includes(",") && !raw.includes(".")) {
    const normalized = raw.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // 123.45 o 12345
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Util: carga pública (acepta {rates:{}} o {items:[{code,rate}]} o {rate})
async function fetchPublicRates(): Promise<{
  rates: Rates;
  asOf?: string | null;
}> {
  try {
    const { data } = await api.get("/fx/public");
    const rates: Rates = { CUP: 1 };

    if (data?.rates && typeof data.rates === "object") {
      for (const k of SELECTABLE_CODES) {
        const raw = data.rates[k] ?? data.rates[String(k).toLowerCase()];
        const n = toNumberLoose(raw);
        if (n && n > 0) rates[k] = n;
      }
    } else if (Array.isArray(data?.items)) {
      for (const it of data.items) {
        const code = String(
          it.code || it.base || ""
        ).toUpperCase() as CurrencyCode;
        const n = toNumberLoose(it.rate);
        if ((SELECTABLE_CODES as string[]).includes(code) && n && n > 0) {
          rates[code] = n;
        }
      }
    } else if (data?.rate != null) {
      const n = toNumberLoose(data.rate);
      if (n && n > 0) rates.USD = n; // legacy
    }

    return { rates, asOf: data?.asOf ?? data?.updatedAt ?? null };
  } catch {
    return { rates: { CUP: 1 }, asOf: null };
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    try {
      const saved = localStorage.getItem("currency") as CurrencyCode | null;
      return saved && (SELECTABLE_CODES as string[]).includes(saved)
        ? (saved as CurrencyCode)
        : "USD";
    } catch {
      return "USD";
    }
  });

  function setCurrency(c: CurrencyCode) {
    setCurrencyState(c);
    try {
      localStorage.setItem("currency", c);
    } catch {}
  }

  // CUP=1 siempre presente para no romper al elegir CUP
  const [rates, setRates] = useState<Rates>({ CUP: 1 });
  const [asOf, setAsOf] = useState<string | null>(null);

  // Cargar una vez al montar + pequeño auto-refresh
  useEffect(() => {
    let mounted = true;
    let timer: any;

    const load = async () => {
      const { rates: r, asOf } = await fetchPublicRates();
      if (mounted) {
        setRates((prev) => ({ ...prev, ...r, CUP: 1 }));
        setAsOf(asOf ?? null);
      }
    };

    load();
    // refresh cada 10 min (ajústalo si quieres)
    timer = setInterval(load, 10 * 60_000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  // Conversión a prueba de bala: SIEMPRE via CUP
  const convert = useMemo(() => {
    return (cents: number, from: CurrencyCode, to: CurrencyCode) => {
      if (!Number.isFinite(cents)) return 0;
      if (from === to) return Math.round(cents);

      const rFrom = from === "CUP" ? 1 : rates[from] ?? 0;
      const rTo = to === "CUP" ? 1 : rates[to] ?? 0;

      // Si falta alguna tasa, no alteramos el monto original
      if (!(rFrom > 0) || !(rTo > 0)) return Math.round(cents);

      // Ej.: 1 USD=402, 1 EUR=450 → 1 USD = 402/450 EUR
      const unitsFrom = cents / 100;
      const inCUP = unitsFrom * rFrom; // from → CUP
      const unitsTo = inCUP / rTo; // CUP → to
      return Math.round(unitsTo * 100);
    };
  }, [rates]);

  // Formateo consistente:
  // - CUP: “NNN.NN MN”
  // - CLA: fallback “NNN.NN CLA”
  // - Resto: Intl con código ISO
  const fmt = useMemo(() => {
    return (cents: number, curr: CurrencyCode) => {
      const amount = Math.max(0, cents) / 100;

      if (curr === "CUP") {
        return (
          amount.toLocaleString(LOCALE_BY_CURR.CUP, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + " MN"
        );
      }

      if (curr === "CLA") {
        // No ISO → fallback
        return (
          amount.toLocaleString(LOCALE_BY_CURR.CLA, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + " CLA"
        );
      }

      const loc =
        LOCALE_BY_CURR[curr] ||
        (typeof navigator !== "undefined" ? navigator.language : "en-US");

      try {
        return new Intl.NumberFormat(loc, {
          style: "currency",
          currency: curr,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        // Fallback general
        return (
          amount.toLocaleString(loc, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) +
          " " +
          curr
        );
      }
    };
  }, []);

  const value: Ctx = { currency, setCurrency, rates, asOf, convert, fmt };
  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
