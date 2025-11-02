import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";

const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    className={cn(
      "w-full rounded-xl px-3 py-2 text-sm outline-none transition",
      "bg-[rgb(var(--card-rgb))] text-[rgb(var(--fg-rgb))]",
      "border border-[rgb(var(--line-rgb))]",
      "placeholder:text-[rgb(var(--fg-rgb)/0.55)]",
      "focus:ring-2 focus:ring-[rgb(var(--primary-rgb)/0.35)] focus:border-[rgb(var(--primary-rgb))]",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      className
    )}
  />
));
export default Input;
