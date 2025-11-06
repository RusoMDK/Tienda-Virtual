import type { ReactNode } from "react";
import Container from "@/layout/Container";

type SearchContainerProps = {
  children: ReactNode;
};

export default function SearchContainer({ children }: SearchContainerProps) {
  return (
    <main className="w-full">
      <Container
        className="
          !max-w-none
          px-3 sm:px-4 md:px-6 lg:px-10 xl:px-14
          py-4 md:py-6
        "
      >
        {/* 
          Repetimos el esquema de 3 columnas del navbar en lg+:
          [auto | minmax(0,1.6fr) | auto]
          y metemos TODO el contenido en la columna central.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1.6fr)_auto] gap-x-0">
          {/* Columna izquierda vacía (logo zona) */}
          <div className="hidden lg:block" />
          {/* Columna central: aquí va toda la página de búsqueda */}
          <div className="min-w-0">{children}</div>
          {/* Columna derecha vacía (cuenta/carrito zona) */}
          <div className="hidden lg:block" />
        </div>
      </Container>
    </main>
  );
}
