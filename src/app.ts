import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { requireAuth } from "./middleware/auth.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { liquidityRoutes } from "./modules/liquidity/liquidity.routes.js";
import { marketplaceRoutes } from "./modules/integrations/marketplace/marketplace.routes.js";
import { env } from "./config/env.js";

const app = new Hono();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In development: allow any localhost origin regardless of port.
// In production:  lock down to ALLOWED_ORIGINS env var (comma-separated).

const isDev = env.NODE_ENV === "development";

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return origin; // non-browser / server-to-server — allow

    if (isDev) {
      // Allow any localhost or 127.0.0.1 origin in dev
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return origin;
      }
    }

    // Production: check against ALLOWED_ORIGINS env var
    const allowed = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (allowed.includes(origin)) return origin;

    return null; // block — hono/cors will respond with 403
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ─── Global middleware ────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", prettyJSON());

// ─── Public routes ────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "flowmaster-ai", timestamp: new Date().toISOString() })
);

app.route("/api/auth", authRoutes);

app.get("/api/marketplace/platforms", async (c) => {
  const { PLATFORM_REGISTRY } = await import("./modules/integrations/marketplace/platform-registry.js");
  return c.json({
    platforms: PLATFORM_REGISTRY.map((p) => ({
      id: p.id, name: p.name, description: p.description, color: p.color,
      icon: p.icon, scopes: p.scopes, docsUrl: p.docsUrl, syncEnabled: p.syncEnabled,
      fields: p.fields,
    })),
  });
});

// ─── Protected routes ─────────────────────────────────────────────────────────

app.use("/api/dashboard/*",   requireAuth);
app.use("/api/liquidity/*",   requireAuth);
app.use("/api/marketplace/*", requireAuth);
app.use("/api/auth/me",       requireAuth);

app.route("/api/dashboard",   dashboardRoutes);
app.route("/api/liquidity",   liquidityRoutes);
app.route("/api/marketplace", marketplaceRoutes);

// ─── Error handling ───────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error("[App] Unhandled error:", err);
  return c.json({
    error: "Internal server error",
    message: env.NODE_ENV === "development" ? err.message : undefined,
  }, 500);
});

export default app;