import { useCurrency, type CurrencyCode } from "./CurrencyProvider";

function norm(code: string): CurrencyCode {
  const up = (code || "USD").toUpperCase();
  const supported = ["USD", "EUR", "MXN", "CAD", "CHF", "CUP", "CLA"] as const;
  return (supported.includes(up as any) ? up : "USD") as CurrencyCode;
}

function fmtHuman(cents: number, curr: CurrencyCode) {
  const amount = Math.max(0, cents) / 100;
  if (curr === "CUP") {
    // Mostrar como “MN”
    return (
      amount.toLocaleString("es-CU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " MN"
    );
  }
  // ISO → Intl; no-ISO (CLA) → fallback "n.nn CLA"
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return (
      amount.toLocaleString("es-ES", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) +
      " " +
      curr
    );
  }
}

/** Muestra el precio convertido a la moneda preferida. CUP se muestra como “MN”. */
export function Price({
  cents,
  currency,
}: {
  cents: number; // base en "currency"
  currency: string; // p.ej. "USD"
}) {
  const { currency: pref, convert } = useCurrency();
  const from = norm(currency);
  const to = pref;
  const converted = convert(cents, from, to); // siempre vía CUP
  return <span>{fmtHuman(converted, to)}</span>;
}
