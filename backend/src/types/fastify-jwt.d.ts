import { Role } from "@prisma/client";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      sub: string;        // user id
      role: Role;         // "ADMIN" | "CUSTOMER"
      iat?: number;
      exp?: number;
    };
  }
}
