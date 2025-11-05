import * as React from "react";
import { cn } from "@/utils/cn";

type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

export default function Container({
  children,
  className,
  ...rest
}: ContainerProps) {
  return (
    <div
      className={cn(
        "container mx-auto px-4 sm:px-5 md:px-6 lg:px-8",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
