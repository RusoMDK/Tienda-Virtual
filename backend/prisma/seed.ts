// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Opcional: no correr en producción
  if (process.env.NODE_ENV === "production") {
    console.log("⏩ Seed saltado en producción");
    return;
  }

  // Solo si no hay categorías aún
  const count = await prisma.category.count();
  if (count > 0) {
    console.log("⏩ Ya hay categorías, seed omitido");
    return;
  }

  await prisma.category.createMany({
    data: [
      { name: "Alimentos", slug: "alimentos" },
      { name: "Aseo y Limpieza", slug: "aseo-limpieza" },
      { name: "Fontanería", slug: "fontaneria" },
      { name: "Electrodomésticos", slug: "electrodomesticos" },
      { name: "Tecnología", slug: "tecnologia" },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed OK (top-level)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
