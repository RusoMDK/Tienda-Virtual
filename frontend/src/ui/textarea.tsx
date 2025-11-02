import { TextareaHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export default function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={cn(
        "w-full min-h-[90px] rounded-xl px-3 py-2 text-sm outline-none transition",
        "bg-[rgb(var(--card-rgb))] text-[rgb(var(--fg-rgb))] border border-[rgb(var(--line-rgb))]",
        "placeholder:text-[rgb(var(--fg-rgb)/0.55)]",
        "focus:ring-2 focus:ring-[rgb(var(--primary-rgb)/0.35)] focus:border-[rgb(var(--primary-rgb))]",
        className
      )}
    />
  );
}
