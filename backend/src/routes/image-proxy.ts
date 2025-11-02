import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Readable } from "node:stream";

const Query = z.object({ u: z.string().url() });

// Hostnames permitidos (puedes añadir/editar según tus fuentes)
const ALLOWED = new Set<string>([
  "images.unsplash.com",
  "source.unsplash.com",
  "picsum.photos",
  "placehold.co",
]);

// Fallback estable por seed (usa tu slug como seed)
function fallbackUrl(seed = "fallback") {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/800`;
}

export default async function imagesProxy(app: FastifyInstance) {
  app.get("/img", async (req, reply) => {
    const { u } = Query.parse(req.query);
    const url = new URL(u);

    // Sólo https + host permitido
    if (url.protocol !== "https:" || !ALLOWED.has(url.hostname)) {
      return reply.code(400).send("invalid image host");
    }

    // Timeout de 5s
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 5000);

    // Siempre un UA decente; algunos CDNs bloquean UA vacíos
    const headers: Record<string, string> = {
      "User-Agent": "TiendaImageProxy/1.0 (+http://localhost)",
      "Accept": "image/*,*/*;q=0.8",
      "Accept-Language": "es,en;q=0.9",
    };

    try {
      const res = await fetch(url, { redirect: "follow", signal: ac.signal, headers });
      clearTimeout(to);

      if (!res.ok || !res.body) {
        // intenta un fallback remoto (también proxyeado) para no romper el UI
        const seed = url.searchParams.get("sig") || url.hostname;
        const fb = await fetch(fallbackUrl(seed), { headers, redirect: "follow" });
        if (!fb.ok || !fb.body) return reply.code(502).send("bad upstream");
        return pipeImage(reply, fb);
      }

      return pipeImage(reply, res);
    } catch (e) {
      clearTimeout(to);
      req.log.warn({ e }, "image fetch error");
      // Último intento: fallback
      try {
        const fb = await fetch(fallbackUrl(url.hostname), {
          headers, redirect: "follow",
        });
        if (!fb.ok || !fb.body) return reply.code(502).send("bad upstream");
        return pipeImage(reply, fb);
      } catch {
        return reply.code(502).send("bad upstream");
      }
    }
  });
}

// Envía el stream al cliente con cabeceras seguras
function pipeImage(reply: any, res: Response) {
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  const cache =
    res.headers.get("cache-control") ??
    "public, max-age=86400, stale-while-revalidate=604800";

  reply.header("Content-Type", ct);
  reply.header("Cache-Control", cache);
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Cross-Origin-Resource-Policy", "cross-origin");
  reply.header("Cross-Origin-Embedder-Policy", "unsafe-none");
  reply.header("Cross-Origin-Opener-Policy", "unsafe-none");
  reply.header("X-Content-Type-Options", "nosniff");

  const nodeStream = Readable.fromWeb(res.body as any);
  return reply.send(nodeStream);
}
