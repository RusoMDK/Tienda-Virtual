import { ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../utils/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  /** Renderiza el hijo como raíz (Link, etc.) */
  asChild?: boolean;
};

const Button = forwardRef<HTMLButtonElement, Props>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      full,
      asChild = false,
      ...rest
    },
    ref
  ) => {
    const base =
      "inline-flex items-center justify-center rounded-xl font-medium select-none outline-none transition-all duration-150 " +
      "focus-visible:ring-2 ring-[rgb(var(--primary-rgb)/0.35)] disabled:opacity-60 disabled:cursor-not-allowed";

    const sizes =
      {
        sm: "text-xs h-9 px-3",
        md: "text-sm h-10 px-4",
        lg: "text-base h-11 px-5",
      }[size] || "text-sm h-10 px-4";

    const variants =
      {
        primary:
          "bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))] hover:bg-[rgb(var(--primary-600-rgb))] active:scale-[0.98]",
        secondary:
          "bg-[rgb(var(--muted-rgb))] text-[rgb(var(--fg-rgb))] border border-[rgb(var(--line-rgb))] hover:bg-[rgb(var(--muted-rgb))]/85",
        ghost:
          "bg-transparent text-[rgb(var(--fg-rgb))] hover:bg-[rgb(var(--muted-rgb))]/60 border border-transparent",
        destructive:
          "bg-[rgb(var(--danger-rgb,220_38_38))] text-white hover:bg-[rgb(var(--danger-rgb,185_28_28))]",
      }[variant] || "";

    const w = full ? "w-full" : "";

    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(base, sizes, variants, w, className)}
        {...rest}
      />
    );
  }
);

Button.displayName = "Button";

export default Button;
