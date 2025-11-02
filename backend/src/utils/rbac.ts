import type { FastifyReply, FastifyRequest } from "fastify";
import { Role } from "@prisma/client";

/**
 * Requiere al menos uno de los roles indicados.
 * Úsalo SIEMPRE junto a app.authenticate en preHandler.
 */
export function requireRole(...roles: Role[]) {
  const allow = new Set<Role>(roles);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as { sub: string; role?: Role } | undefined;

    if (!user) {
      // No hay JWT decodificado → probablemente faltó app.authenticate
      req.log.warn("requireRole: missing req.user; did you include app.authenticate?");
      return reply.unauthorized("Authentication required");
    }
    if (!user.role || !allow.has(user.role)) {
      req.log.warn(
        { userId: user.sub, role: user.role, required: [...allow] },
        "requireRole: forbidden (role mismatch)"
      );
      return reply.forbidden("Insufficient role");
    }
  };
}

/**
 * Atajo común para ADMIN.
 * Ej: { preHandler: [app.authenticate, requireAdmin] }
 */
export const requireAdmin = requireRole(Role.ADMIN);

/**
 * Permite si el usuario es el dueño del recurso (ownerId) o si tiene un rol concreto (por ejemplo ADMIN).
 * Útil para endpoints como /users/:id, /orders/:id, etc.
 *
 * Ejemplo:
 *   preHandler: [
 *     app.authenticate,
 *     requireSelfOrRole(Role.ADMIN, (req) => (req.params as any).id)
 *   ]
 */
export function requireSelfOrRole(
  role: Role,
  ownerIdSelector: (req: FastifyRequest) => string
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as { sub: string; role?: Role } | undefined;

    if (!user) return reply.unauthorized("Authentication required");

    const ownerId = ownerIdSelector(req);
    if (user.sub === ownerId || user.role === role) return;

    req.log.warn(
      { userId: user.sub, role: user.role, ownerId, requiredRole: role },
      "requireSelfOrRole: forbidden"
    );
    return reply.forbidden("Insufficient privileges");
  };
}
