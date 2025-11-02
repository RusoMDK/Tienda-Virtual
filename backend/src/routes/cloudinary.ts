import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";

export default async function cloudinaryRoutes(app: FastifyInstance) {
  app.post("/cloudinary/signature", { preHandler: [app.authenticate] }, async (req) => {
    const {
      CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET,
      CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_AVATARS_FOLDER,
      CLOUDINARY_FOLDER,
    } = process.env;

    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_CLOUD_NAME) {
      app.log.error("Cloudinary no está configurado en .env");
      app.httpErrors.internalServerError("Cloudinary no está configurado");
    }

    const body = (req.body || {}) as { folder?: string; publicId?: string };
    const folder = body.folder || CLOUDINARY_AVATARS_FOLDER || CLOUDINARY_FOLDER || "tienda/uploads";
    const timestamp = Math.floor(Date.now() / 1000);

    // ¡Orden lexicográfico de keys para firmar!
    const params: Record<string, string> = { folder, timestamp: String(timestamp) };
    if (body.publicId) params.public_id = body.publicId;

    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signature = crypto
      .createHash("sha1")
      .update(toSign + CLOUDINARY_API_SECRET!)
      .digest("hex");

    return {
      timestamp,
      signature,
      apiKey: CLOUDINARY_API_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
      folder,
    };
  });
}
