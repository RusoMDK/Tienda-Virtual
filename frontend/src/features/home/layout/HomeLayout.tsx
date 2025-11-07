// src/features/home/layout/HomeLayout.tsx
import type { ReactNode } from "react";
import Container from "@/layout/Container";

type HomeLayoutProps = {
  hero?: ReactNode;
  children: ReactNode;
};

export default function HomeLayout({ hero, children }: HomeLayoutProps) {
  return (
    // 👇 evitamos scroll horizontal cueste lo que cueste
    <div className="bg-[rgb(var(--bg-rgb))] overflow-x-hidden">
      {/* HERO full-bleed fuera del Container */}
      {hero && <div className="w-full">{hero}</div>}

      {/* Resto del contenido dentro del Container normal */}
      <Container className="py-6 md:py-8">{children}</Container>
    </div>
  );
}
