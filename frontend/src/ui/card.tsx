import { cn } from "../utils/cn";

export function Card({ className, children }: any) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--line-rgb))] shadow-[0_1px_0_0_rgba(0,0,0,.15)]",
        className
      )}
    >
      {children}
    </div>
  );
}
export function CardHeader({ className, children }: any) {
  return (
    <div
      className={cn(
        "p-4 border-b border-[rgb(var(--line-rgb))] flex items-center justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}
export function CardContent({ className, children }: any) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
export function CardFooter({ className, children }: any) {
  return (
    <div
      className={cn("p-4 border-t border-[rgb(var(--line-rgb))]", className)}
    >
      {children}
    </div>
  );
}
