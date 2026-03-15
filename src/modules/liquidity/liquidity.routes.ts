import { Hono } from "hono";
import { getMerchantId } from "../../middleware/auth.js";
import { liquidityService, liquidityRequestSchema } from "./liquidity.service.js";

export const liquidityRoutes = new Hono();

liquidityRoutes.post("/request", async (c) => {
  const merchantId = getMerchantId(c);

  let body: unknown;
  try { body = await c.req.json(); }
  catch { return c.json({ error: "Invalid JSON body" }, 400); }

  const parsed = liquidityRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
  }

  try {
    const result = await liquidityService.submitRequest(merchantId, parsed.data);
    return c.json(result, 201);
  } catch (err) {
    console.error("[LiquidityRoutes] POST /request error:", err);
    return c.json({ error: "Failed to submit liquidity request" }, 500);
  }
});
