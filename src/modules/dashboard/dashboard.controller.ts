import type { Context } from "hono";
import { getMerchantId } from "../../middleware/auth.js";
import { cashflowService } from "../cashflow/cashflow.service.js";
import { evaluateRisk, calcRecommendedLiquidity } from "../cashflow/risk-engine.js";
import { financialEventsRepository } from "../finance/financial-events.repository.js";

export const dashboardController = {
  // ── GET /api/dashboard/summary ──────────────────────────────────────────────
  async getSummary(c: Context) {
    try {
      const merchantId = getMerchantId(c);
      const summary = await cashflowService.getMerchantSummary(merchantId);
      const risk = evaluateRisk(summary);
      const recommendedLiquidity = calcRecommendedLiquidity(summary, risk);

      return c.json({
        availableToday:      summary.availableToday,
        inTransit:           summary.inTransit,
        forecast14d:         summary.forecast14d,
        avgDailyInflow:      summary.avgDailyInflow,
        avgDailyExpenses:    summary.avgDailyExpenses,
        riskLevel:           risk.riskLevel,
        cashCoverageDays:    risk.cashCoverageDays,
        warnings:            risk.warnings,
        recommendedLiquidity,
      });
    } catch (err) {
      console.error("[Dashboard] getSummary error:", err);
      return c.json({ error: "Failed to compute cashflow summary" }, 500);
    }
  },

  // ── GET /api/dashboard/events ────────────────────────────────────────────────
  // Returns the raw financial_events for this merchant.
  // Query params:
  //   days=30       how many days back to fetch (default 60, max 365)
  //   limit=100     max events to return    (default 200, max 500)
  //
  // Response shape matches the frontend FINANCIAL_EVENTS array exactly so the
  // existing computeSummary / computeRisk / render functions work unchanged.
  async getEvents(c: Context) {
    try {
      const merchantId = getMerchantId(c);

      const daysBack = Math.min(parseInt(c.req.query("days") ?? "60"),  365);
      const limit    = Math.min(parseInt(c.req.query("limit") ?? "200"), 500);

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysBack);

      const rows = await financialEventsRepository.findMany({
        merchantId,
        fromDate,
      });

      // Shape each row into the lightweight frontend format
      // (amounts as numbers, dates as ISO strings, no internal DB fields)
      const events = rows.slice(0, limit).map((e) => ({
        platform:      e.platform,
        event_type:    e.eventType,
        amount:        parseFloat(e.amount),
        currency:      e.currency,
        status:        e.status,
        event_date:    e.eventDate.toISOString().split("T")[0],
        expected_date: e.expectedDate
          ? e.expectedDate.toISOString().split("T")[0]
          : undefined,
      }));

      return c.json({ events, total: rows.length });
    } catch (err) {
      console.error("[Dashboard] getEvents error:", err);
      return c.json({ error: "Failed to fetch financial events" }, 500);
    }
  },
};