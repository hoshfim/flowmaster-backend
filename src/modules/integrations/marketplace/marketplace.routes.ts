import { Hono } from "hono";
import { getMerchantId } from "../../../middleware/auth.js";
import {
  marketplaceService,
  createConnectionSchema,
  updateConnectionSchema,
  ValidationError,
  NotFoundError,
} from "./marketplace.service.js";
import { PLATFORM_REGISTRY } from "./platform-registry.js";

export const marketplaceRoutes = new Hono();

function handleError(c: any, err: unknown) {
  console.error("[MarketplaceRoutes]", err);
  if (err instanceof ValidationError) return c.json({ error: err.message }, 422);
  if (err instanceof NotFoundError)   return c.json({ error: err.message }, 404);
  return c.json({ error: "Internal server error" }, 500);
}

// GET /api/marketplace/platforms  — public, no auth needed
marketplaceRoutes.get("/platforms", (c) => {
  const platforms = PLATFORM_REGISTRY.map((p) => ({
    id: p.id, name: p.name, description: p.description, color: p.color,
    icon: p.icon, scopes: p.scopes, docsUrl: p.docsUrl, syncEnabled: p.syncEnabled,
    fields: p.fields.map((f) => ({
      key: f.key, label: f.label, placeholder: f.placeholder,
      type: f.type, required: f.required, helpText: f.helpText,
    })),
  }));
  return c.json({ platforms });
});

// All connection routes require auth — merchantId from JWT context
marketplaceRoutes.get("/connections", async (c) => {
  try {
    const connections = await marketplaceService.listConnections(getMerchantId(c));
    return c.json({ connections });
  } catch (err) { return handleError(c, err); }
});

marketplaceRoutes.get("/connections/:id", async (c) => {
  try {
    const connection = await marketplaceService.getConnection(getMerchantId(c), c.req.param("id"));
    if (!connection) return c.json({ error: "Connection not found" }, 404);
    return c.json({ connection });
  } catch (err) { return handleError(c, err); }
});

marketplaceRoutes.post("/connections", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body" }, 400); }
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
  try {
    const connection = await marketplaceService.createConnection(getMerchantId(c), parsed.data);
    return c.json({ connection }, 201);
  } catch (err) { return handleError(c, err); }
});

marketplaceRoutes.patch("/connections/:id", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON body" }, 400); }
  const parsed = updateConnectionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
  try {
    const connection = await marketplaceService.updateConnection(getMerchantId(c), c.req.param("id"), parsed.data);
    return c.json({ connection });
  } catch (err) { return handleError(c, err); }
});

marketplaceRoutes.delete("/connections/:id", async (c) => {
  try {
    await marketplaceService.deleteConnection(getMerchantId(c), c.req.param("id"));
    return c.json({ success: true });
  } catch (err) { return handleError(c, err); }
});

marketplaceRoutes.post("/connections/:id/sync", async (c) => {
  try {
    await marketplaceService.triggerSync(getMerchantId(c), c.req.param("id"));
    return c.json({ success: true, message: "Sync triggered — running in background" });
  } catch (err) { return handleError(c, err); }
});
