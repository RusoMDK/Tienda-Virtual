// backend/src/routes/cloudinary.ts
// Endpoint de firma: /cloudinary/signature
// Respeta la semántica alias+folder y devuelve la carpeta FINAL firmada.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";
import {
  resolveFolder,
  FOLDERS,
  ensureUnderRootOrThrow,
} from "../lib/cloudinary.js";

const SignSchema = z.object({
  alias: z.enum(["root", "products", "avatars", "categories"]).optional(),
  folder: z.string().min(1).optional(),
  publicId: z.string().min(1).optional(),
  overwrite: z.boolean().optional(),
  invalidate: z.boolean().optional(),
});

export default async function cloudinaryRoutes(app: FastifyInstance) {
  app.post(
    "/cloudinary/signature",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const {
        CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET,
        CLOUDINARY_CLOUD_NAME,
      } = process.env;

      if (
        !CLOUDINARY_API_KEY ||
        !CLOUDINARY_API_SECRET ||
        !CLOUDINARY_CLOUD_NAME
      ) {
        app.log.error("[cloudinary] Faltan variables CLOUDINARY_* en .env");
        throw app.httpErrors.internalServerError(
          "Cloudinary no está configurado"
        );
      }

      const parsed = SignSchema.parse(req.body ?? {});
      const { alias, folder, publicId, overwrite, invalidate } = parsed;

      // Normaliza y asegura que la carpeta final quede bajo ROOT
      const finalFolder = resolveFolder({ alias, folder });
      ensureUnderRootOrThrow(finalFolder);

      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign: Record<string, any> = {
        timestamp,
        folder: finalFolder,
      };
      if (publicId) paramsToSign.public_id = publicId;
      if (typeof overwrite === "boolean") paramsToSign.overwrite = overwrite;
      if (typeof invalidate === "boolean") paramsToSign.invalidate = invalidate;

      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        CLOUDINARY_API_SECRET
      );

      // Log útil para depurar dónde está firmando
      app.log.info(
        { alias: alias ?? "root", folder, finalFolder },
        "[cloudinary] signature"
      );

      reply.header("Cache-Control", "no-store");
      return {
        cloudName: CLOUDINARY_CLOUD_NAME,
        apiKey: CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder: finalFolder, // <- ESTA es la carpeta que debe usar el frontend en el upload
        publicId: publicId ?? null,
      };
    }
  );

  // (Opcional) Ping para ver mapeo en runtime
  app.get(
    "/cloudinary/folders",
    { preHandler: [app.authenticate] },
    async () => FOLDERS
  );
}
