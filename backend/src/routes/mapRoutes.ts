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
  /**
   * GET /maps/autocomplete?text=habana&limit=8
   * Devuelve varias sugerencias de direcciones/lugares.
   */
  app.get("/autocomplete", async (request, reply) => {
    try {
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

      // Siempre devolvemos { results: [...] }
      return reply.send({ results });
    } catch (err) {
      console.error("[maps/autocomplete] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error en el servicio de autocompletado." });
    }
  });

  /**
   * GET /maps/geocode?text=calle+23+vedado
   * Geocodificación directa: texto → coords.
   */
  app.get("/geocode", async (request, reply) => {
    try {
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
    } catch (err) {
      console.error("[maps/geocode] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error en el servicio de geocodificación." });
    }
  });

  /**
   * Alias legacy para algunos frontends:
   * GET /maps/search?q=...
   * Devuelve { result: GeocodeResult | null }
   */
  app.get("/search", async (request, reply) => {
    try {
      const { q = "" } = request.query as { q?: string };
      const t = (q || "").trim();
      if (!t) {
        return reply.status(400).send({ error: "Parámetro 'q' es requerido." });
      }

      const result = await geoapifyGeocode(t);
      return reply.send({ result: result ?? null });
    } catch (err) {
      console.error("[maps/search] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error en el servicio de búsqueda de direcciones." });
    }
  });

  /**
   * GET /maps/reverse?lat=...&lon=...
   * Reverse geocoding: coords → dirección.
   */
  app.get("/reverse", async (request, reply) => {
    try {
      const { lat, lon } = request.query as {
        lat?: string | number;
        lon?: string | number;
      };

      const latNum = Number(lat);
      const lonNum = Number(lon);

      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
        return reply.status(400).send({
          error:
            "Parámetros 'lat' y 'lon' son requeridos y deben ser numéricos.",
        });
      }

      const result = await geoapifyReverseGeocode(latNum, lonNum);
      if (!result) {
        return reply.status(404).send({ error: "No se encontró dirección." });
      }

      return reply.send(result);
    } catch (err) {
      console.error("[maps/reverse] Error:", err);
      return reply
        .status(500)
        .send({ error: "Error en el servicio de reverse geocoding." });
    }
  });
}
