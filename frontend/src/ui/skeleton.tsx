import { cn } from "../utils/cn";

export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[rgb(var(--muted-rgb)/0.65)]",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "before:animate-[shimmer_1.2s_infinite]",
        className
      )}
    />
  );
}

/* CSS global (una sola vez):
@keyframes shimmer { 100% { transform: translateX(100%); } }
*/
