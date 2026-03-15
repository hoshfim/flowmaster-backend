/**
 * JWT Auth Middleware for Hono.
 *
 * Reads the Authorization: Bearer <token> header, verifies the access token,
 * and injects merchantId + merchant context into the Hono context.
 *
 * Routes wrapped with this middleware no longer need ?merchantId= query params.
 */

import type { Context, Next } from "hono";
import { verifyAccessToken } from "../modules/auth/token.utils.js";

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header missing or malformed" }, 401);
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = await verifyAccessToken(token);

    // Inject into context — available in all downstream handlers via c.get()
    c.set("merchantId",   payload.sub);
    c.set("merchantEmail", payload.email);
    c.set("merchantCompany", payload.companyName);

    await next();
  } catch (err) {
    // jose throws on expiry, bad signature, wrong issuer, etc.
    const isExpired = err instanceof Error && err.message.includes("expired");
    return c.json(
      { error: isExpired ? "Access token expired" : "Invalid access token" },
      401
    );
  }
}

/**
 * Convenience helper: read merchantId from context (set by requireAuth).
 * Throws a typed 401 if called on an unprotected route by mistake.
 */
export function getMerchantId(c: Context): string {
  const id = c.get("merchantId") as string | undefined;
  if (!id) throw new Error("getMerchantId called outside of authenticated context");
  return id;
}
