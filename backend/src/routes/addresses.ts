// src/routes/addresses.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const addrSchema = z.object({
  label: z.string().optional(),
  recipientName: z.string().min(1),
  phone: z.string().optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  postalCode: z.string().min(2),
  country: z.string().min(2),

  // 🌍 Campos de mapa (todos opcionales)
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  mapLabel: z.string().optional(),
  geoProvider: z.string().optional(), // p.ej. "geoapify"
  geoPlaceId: z.string().optional(),

  // flags solo para lógica, NO se guardan en la tabla
  setDefaultShipping: z.boolean().optional(),
  setDefaultBilling: z.boolean().optional(),
});

export default async function addressesRoutes(app: FastifyInstance) {
  app.get("/me/addresses", { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req as any).user.sub as string;
    return app.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/me/addresses", { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req as any).user.sub as string;

    // 👇 separamos datos de address vs flags
    const { setDefaultShipping, setDefaultBilling, ...addrData } =
      addrSchema.parse(req.body);

    const created = await app.prisma.$transaction(async (tx) => {
      // incluye lat/lng/mapLabel/geo* porque están en addrData
      const addr = await tx.address.create({
        data: {
          ...addrData,
          userId,
        },
      });

      // set defaults si procede
      if (setDefaultShipping) {
        await tx.user.update({
          where: { id: userId },
          data: { defaultShippingAddressId: addr.id },
        });
        await tx.address.updateMany({
          where: { userId },
          data: { isDefaultShipping: false },
        });
        await tx.address.update({
          where: { id: addr.id },
          data: { isDefaultShipping: true },
        });
      }
      if (setDefaultBilling) {
        await tx.user.update({
          where: { id: userId },
          data: { defaultBillingAddressId: addr.id },
        });
        await tx.address.updateMany({
          where: { userId },
          data: { isDefaultBilling: false },
        });
        await tx.address.update({
          where: { id: addr.id },
          data: { isDefaultBilling: true },
        });
      }

      return addr;
    });

    return created;
  });

  app.patch(
    "/me/addresses/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const { id } = req.params as { id: string };

      // partial para permitir actualizar solo algunos campos
      const {
        setDefaultShipping: _s,
        setDefaultBilling: _b,
        ...addrData
      } = addrSchema.partial().parse(req.body);

      const addr = await app.prisma.address.findFirst({
        where: { id, userId },
      });
      if (!addr) return reply.notFound("Address not found");

      // aquí también se actualizan lat/lng/mapLabel/geo*
      const updated = await app.prisma.address.update({
        where: { id },
        data: addrData,
      });
      return updated;
    }
  );

  app.delete(
    "/me/addresses/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const { id } = req.params as { id: string };

      const addr = await app.prisma.address.findFirst({
        where: { id, userId },
      });
      if (!addr) return reply.notFound();

      await app.prisma.$transaction(async (tx) => {
        // limpia defaults del user si apuntaban a esta address
        await tx.user.updateMany({
          where: {
            id: userId,
            OR: [
              { defaultShippingAddressId: id },
              { defaultBillingAddressId: id },
            ],
          },
          data: {
            defaultShippingAddressId: null,
            defaultBillingAddressId: null,
          },
        });
        await tx.address.delete({ where: { id } });
      });

      return { ok: true };
    }
  );

  app.patch(
    "/me/addresses/:id/default",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const { id } = req.params as { id: string };
      const { type } = z
        .object({ type: z.enum(["shipping", "billing"]) })
        .parse(req.query);

      const addr = await app.prisma.address.findFirst({
        where: { id, userId },
      });
      if (!addr) return reply.notFound("Address not found");

      await app.prisma.$transaction(async (tx) => {
        if (type === "shipping") {
          await tx.user.update({
            where: { id: userId },
            data: { defaultShippingAddressId: id },
          });
          await tx.address.updateMany({
            where: { userId },
            data: { isDefaultShipping: false },
          });
          await tx.address.update({
            where: { id },
            data: { isDefaultShipping: true },
          });
        } else {
          await tx.user.update({
            where: { id: userId },
            data: { defaultBillingAddressId: id },
          });
          await tx.address.updateMany({
            where: { userId },
            data: { isDefaultBilling: false },
          });
          await tx.address.update({
            where: { id },
            data: { isDefaultBilling: true },
          });
        }
      });

      return { ok: true };
    }
  );
}
