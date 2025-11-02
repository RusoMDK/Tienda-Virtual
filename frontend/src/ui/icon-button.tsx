import { ButtonHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export default function IconButton(
  props: ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, ...rest } = props;
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all",
        "bg-[rgb(var(--card-rgb))] border border-[rgb(var(--line-rgb))]",
        "hover:bg-[rgb(var(--muted-rgb))]/70 active:scale-[0.98]",
        "text-[rgb(var(--fg-rgb))]",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
    />
  );
}
