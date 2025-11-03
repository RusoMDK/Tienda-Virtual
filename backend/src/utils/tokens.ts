// backend/src/utils/tokens.ts
import { randomBytes } from "node:crypto";

/**
 * Genera un string seguro/URL-safe para refresh tokens.
 * ~64 chars, entropía alta.
 */
export function newTokenString(): string {
  return randomBytes(48).toString("base64url");
}
