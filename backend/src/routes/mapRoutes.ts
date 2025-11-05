// src/routes/mapRoutes.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  geoapifyAutocomplete,
  geoapifyGeocode,
  geoapifyReverseGeocode,
} from "../services/geoapify";

export default async function mapRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  // GET /maps/autocomplete?text=habana&limit=8
  app.get("/autocomplete", async (request, reply) => {
    const { text = "", limit } = request.query as {
      text?: string;
      limit?: string | number;
    };

    const t = (text || "").trim();
    if (!t) {
      return reply
        .status(400)
        .send({ error: "Parámetro 'text' es requerido." });
    }

    const lim = Math.min(15, Math.max(1, Number(limit) || 5));
    const results = await geoapifyAutocomplete(t, lim);

    return reply.send({ results });
  });

  // GET /maps/geocode?text=calle+23+vedado
  app.get("/geocode", async (request, reply) => {
    const { text = "" } = request.query as { text?: string };
    const t = (text || "").trim();
    if (!t) {
      return reply
        .status(400)
        .send({ error: "Parámetro 'text' es requerido." });
    }

    const result = await geoapifyGeocode(t);
    if (!result) {
      return reply.status(404).send({ error: "No se encontró dirección." });
    }

    return reply.send(result);
  });

  // GET /maps/reverse?lat=...&lon=...
  app.get("/reverse", async (request, reply) => {
    const { lat, lon } = request.query as {
      lat?: string | number;
      lon?: string | number;
    };

    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return reply.status(400).send({
        error: "Parámetros 'lat' y 'lon' son requeridos y deben ser numéricos.",
      });
    }

    const result = await geoapifyReverseGeocode(latNum, lonNum);
    if (!result) {
      return reply.status(404).send({ error: "No se encontró dirección." });
    }

    return reply.send(result);
  });
}
