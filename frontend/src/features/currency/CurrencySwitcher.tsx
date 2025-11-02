import { useCurrency, SELECTABLE_CODES } from "./CurrencyProvider";

export default function CurrencySwitcher({
  className = "",
}: {
  className?: string;
}) {
  const { currency, setCurrency } = useCurrency();
  return (
    <select
      className={`rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm ${className}`}
      value={currency}
      onChange={(e) => setCurrency(e.target.value as any)}
      title="Moneda preferida"
    >
      {SELECTABLE_CODES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
