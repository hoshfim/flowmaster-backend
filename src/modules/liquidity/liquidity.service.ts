import { db } from "../../db/client.js";
import { liquidityRequests, type NewLiquidityRequest } from "../../db/schema.js";
import { z } from "zod";

// ─── Validation Schema ────────────────────────────────────────────────────────

export const liquidityRequestSchema = z.object({
  request_id: z.string().uuid("request_id must be a valid UUID"),
  user_data: z.object({
    company_id: z.string().min(1),
    avg_monthly_revenue: z.number().positive(),
    risk_score: z.number().min(0).max(100),
    cash_coverage_days: z.number().min(0),
  }),
  collateral: z.object({
    in_transit_funds: z.number().min(0),
  }),
  request: z.object({
    amount_to_liquidate: z.number().positive(),
    platform_fee: z.number().min(0),
  }),
});

export type LiquidityRequestPayload = z.infer<typeof liquidityRequestSchema>;

// ─── Service ──────────────────────────────────────────────────────────────────

export class LiquidityService {
  /**
   * Validate and persist a liquidity request.
   * In production this would also trigger underwriting / partner API calls.
   */
  async submitRequest(
    merchantId: string,
    payload: LiquidityRequestPayload
  ): Promise<{ success: boolean; requestId: string; status: string }> {
    const record: NewLiquidityRequest = {
      id: payload.request_id,
      merchantId,
      companyId: payload.user_data.company_id,
      avgMonthlyRevenue: payload.user_data.avg_monthly_revenue.toFixed(4),
      riskScore: payload.user_data.risk_score.toFixed(2),
      cashCoverageDays: payload.user_data.cash_coverage_days.toFixed(2),
      inTransitFunds: payload.collateral.in_transit_funds.toFixed(4),
      amountToLiquidate: payload.request.amount_to_liquidate.toFixed(4),
      platformFee: payload.request.platform_fee.toFixed(4),
      status: "pending",
    };

    await db
      .insert(liquidityRequests)
      .values(record)
      .onConflictDoNothing(); // idempotent – same request_id won't double-insert

    console.log(
      `[LiquidityService] Request ${payload.request_id} submitted for merchant ${merchantId}`
    );

    return {
      success: true,
      requestId: payload.request_id,
      status: "pending",
    };
  }
}

export const liquidityService = new LiquidityService();
