// src/features/admin/layout/AdminContainer.tsx
import * as React from "react";
import { cn } from "@/utils/cn";

type AdminContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export default function AdminContainer({
  children,
  className,
}: AdminContainerProps) {
  return (
    <div
      className={cn(
        // Siempre ocupar el ancho disponible
        "w-full mx-auto",

        // Ancho máximo MUCHO más cómodo para monitores grandes
        //  -> hasta ~1536px centrado (perfecto para 27")
        "max-w-screen-2xl",

        // Padding lateral responsivo (mínimo 360px se ve bien)
        "px-3 sm:px-4 lg:px-6 2xl:px-8",

        className
      )}
    >
      {children}
    </div>
  );
}
