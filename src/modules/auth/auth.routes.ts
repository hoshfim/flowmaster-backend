import { Hono } from "hono";
import {
  authService,
  registerSchema,
  loginSchema,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from "./auth.service.js";

export const authRoutes = new Hono();

function handleError(c: any, err: unknown) {
  if (err instanceof ConflictError)     return c.json({ error: err.message }, 409);
  if (err instanceof UnauthorizedError) return c.json({ error: err.message }, 401);
  if (err instanceof NotFoundError)     return c.json({ error: err.message }, 404);
  console.error("[AuthRoutes]", err);
  return c.json({ error: "Internal server error" }, 500);
}

function getMeta(c: any) {
  return {
    userAgent: c.req.header("user-agent"),
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0].trim()
      ?? c.req.header("x-real-ip")
      ?? "unknown",
  };
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

authRoutes.post("/register", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "Invalid JSON body" }, 400); }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
  }

  try {
    const tokens = await authService.register(parsed.data);
    return c.json(tokens, 201);
  } catch (err) {
    return handleError(c, err);
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRoutes.post("/login", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "Invalid JSON body" }, 400); }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
  }

  try {
    const tokens = await authService.login(parsed.data, getMeta(c));
    return c.json(tokens);
  } catch (err) {
    return handleError(c, err);
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

authRoutes.post("/refresh", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "Invalid JSON body" }, 400); }

  const { refreshToken } = (body as Record<string, unknown>);
  if (!refreshToken || typeof refreshToken !== "string") {
    return c.json({ error: "refreshToken is required" }, 400);
  }

  try {
    const tokens = await authService.refresh(refreshToken, getMeta(c));
    return c.json(tokens);
  } catch (err) {
    return handleError(c, err);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRoutes.post("/logout", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "Invalid JSON body" }, 400); }

  const { refreshToken } = (body as Record<string, unknown>);
  if (refreshToken && typeof refreshToken === "string") {
    await authService.logout(refreshToken).catch(() => {});
  }

  return c.json({ success: true });
});

// ─── GET /api/auth/me  (requires auth middleware) ─────────────────────────────

authRoutes.get("/me", async (c) => {
  const merchantId = c.get("merchantId") as string;
  if (!merchantId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const merchant = await authService.getMe(merchantId);
    return c.json({ merchant });
  } catch (err) {
    return handleError(c, err);
  }
});
