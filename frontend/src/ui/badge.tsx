import * as React from "react";
import { cn } from "../utils/cn";

export default function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-medium",
        "bg-[rgb(var(--muted-rgb))] text-[rgb(var(--fg-rgb))] border border-[rgb(var(--line-rgb))]",
        "transition-colors",
        className
      )}
    >
      {children}
    </span>
  );
}
