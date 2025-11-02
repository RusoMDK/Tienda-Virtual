// src/services/fx.ts
import type { FastifyInstance } from "fastify";

export async function getLatestRate(app: FastifyInstance, base="USD", quote="CUP") {
  return app.prisma.fxRate.findFirst({
    where: { base, quote },
    orderBy: { effectiveAt: "desc" },
  });
}

export async function upsertIfChanged(
  app: FastifyInstance,
  rate: number,
  source = "informal",
  note?: string,
  base = "USD",
  quote = "CUP",
) {
  const prev = await getLatestRate(app, base, quote);
  if (prev && Math.abs(Number(prev.rate) - rate) < 0.0001) {
    return { created: false, fx: prev };
  }
  const fx = await app.prisma.fxRate.create({
    data: { base, quote, rate, source, note: note ?? null },
  });
  return { created: true, fx };
}
