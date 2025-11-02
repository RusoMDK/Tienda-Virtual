import { cn } from "../utils/cn";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

export default function Switch({ checked, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "h-6 w-11 rounded-full transition-all px-0.5 outline-none",
        "focus-visible:ring-2 ring-[rgb(var(--primary-rgb)/0.35)]",
        checked ? "bg-[rgb(var(--primary-rgb))]" : "bg-[rgb(var(--line-rgb))]",
        disabled && "opacity-50 pointer-events-none"
      )}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full shadow transition-all translate-x-0",
          "bg-[rgb(var(--bg-rgb))]",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}
