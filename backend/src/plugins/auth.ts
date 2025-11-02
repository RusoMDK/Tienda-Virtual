// src/plugins/auth.ts
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { Role } from "@prisma/client";

/** ================================
 *  Tipado para @fastify/jwt
 *  ================================ */
declare module "@fastify/jwt" {
  interface FastifyJWT {
    // lo que vas a firmar en el token
    payload: { sub: string; role?: Role };
    // lo que jwtVerify() coloca en req.user
    user: { sub: string; role?: Role };
  }
}

/** ================================
 *  Extensiones Fastify (decorators)
 *  ================================ */
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    signAccess: (payload: { sub: string; role?: Role }) => string;
    signRefresh: (payload: { sub: string; role?: Role }) => string;

    // Guards de rol:
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireSupport: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Admin o Support */
    requireStaff: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

    // Helpers genéricos (factories de guards):
    requireRole: (
      role: Role
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAnyRole: (
      roles: Role[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: { sub: string; role?: Role };
  }
}

export default fp(async (app: FastifyInstance) => {
  // ================= JWT =================
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    // Defaults para no repetir en sign/verify
    sign: {
      issuer: "tienda-api",
      audience: "web",
    },
    verify: {
      issuer: "tienda-api",
      audience: "web",
    },
  });

  // Firmadores (ACCESS / REFRESH)
  if (!app.hasDecorator("signAccess")) {
    app.decorate(
      "signAccess",
      (payload: { sub: string; role?: Role }): string =>
        app.jwt.sign(payload, {
          // secret por defecto = ACCESS (configurada arriba)
          expiresIn: env.JWT_ACCESS_TTL, // ej "15m"
        })
    );
  }

  if (!app.hasDecorator("signRefresh")) {
    app.decorate(
      "signRefresh",
      (payload: { sub: string; role?: Role }): string =>
        app.jwt.sign(payload, {
          // REFRESH usa secret distinto
          secret: env.JWT_REFRESH_SECRET,
          expiresIn: env.JWT_REFRESH_TTL, // ej "7d"
          issuer: "tienda-api",
          audience: "web",
        })
    );
  }

  // ================= Auth básica =================
  if (!app.hasDecorator("authenticate")) {
    app.decorate("authenticate", async (req, reply) => {
      try {
        await req.jwtVerify(); // usa verify.defaults (issuer/audience)
      } catch {
        // @ts-ignore si tienes fastify-sensible
        return typeof reply.unauthorized === "function"
          ? // @ts-ignore
            reply.unauthorized()
          : reply.code(401).send({ error: "Unauthorized" });
      }
    });
  }

  // Helpers respuesta 403
  const forbid = (reply: FastifyReply, msg = "Forbidden") => {
    // @ts-ignore si tienes fastify-sensible
    return typeof reply.forbidden === "function"
      ? // @ts-ignore
        reply.forbidden(msg)
      : reply.code(403).send({ error: msg });
  };

  // ================= Guards =================
  const makeGuard =
    (roles: Role[] | Role) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(req, reply);
      if (reply.sent) return; // si authenticate ya respondió 401
      const role = req.user?.role;
      const allowed = Array.isArray(roles) ? roles : [roles];
      if (!role || !allowed.includes(role)) {
        return forbid(reply, "Insufficient role");
      }
    };

  if (!app.hasDecorator("requireRole")) {
    app.decorate("requireRole", (role: Role) => makeGuard(role));
  }
  if (!app.hasDecorator("requireAnyRole")) {
    app.decorate("requireAnyRole", (roles: Role[]) => makeGuard(roles));
  }
  if (!app.hasDecorator("requireAdmin")) {
    app.decorate("requireAdmin", makeGuard(Role.ADMIN));
  }
  if (!app.hasDecorator("requireSupport")) {
    app.decorate("requireSupport", makeGuard(Role.SUPPORT));
  }
  if (!app.hasDecorator("requireStaff")) {
    app.decorate("requireStaff", makeGuard([Role.ADMIN, Role.SUPPORT]));
  }
});
