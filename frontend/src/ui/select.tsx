import { SelectHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export default function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        "w-full rounded-xl px-3 py-2 text-sm outline-none transition bg-[rgb(var(--card-rgb))] text-[rgb(var(--fg-rgb))]",
        "border border-[rgb(var(--line-rgb))]",
        "focus:ring-2 focus:ring-[rgb(var(--primary-rgb)/0.35)] focus:border-[rgb(var(--primary-rgb))]",
        className
      )}
    />
  );
}
