import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { merchantFinancialSettings } from "../../db/schema.js";
import { financialEventsRepository } from "../finance/financial-events.repository.js";

export interface CashflowSummary {
  availableToday: number;
  inTransit: number;
  forecast14d: number;
  avgDailyInflow: number;
  avgDailyExpenses: number;
}

export class CashflowService {
  /**
   * Compute a full cashflow summary for a given merchant.
   *
   * All monetary values are in the merchant's primary currency.
   */
  async getMerchantSummary(merchantId: string): Promise<CashflowSummary> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Available Today ───────────────────────────────────────────────────────
    // cleared payouts − cleared refunds − cleared fees
    const [clearedPayouts, clearedRefunds, clearedFees] = await Promise.all([
      financialEventsRepository.sumAmounts(
        merchantId,
        ["payout", "reserve_release"],
        "cleared"
      ),
      financialEventsRepository.sumAmounts(
        merchantId,
        ["refund"],
        "cleared"
      ),
      financialEventsRepository.sumAmounts(
        merchantId,
        ["fee"],
        "cleared"
      ),
    ]);

    // Refunds and fees stored as negative values; summing them directly gives
    // the correct subtraction. For defensive clarity we use Math.abs.
    const availableToday =
      clearedPayouts - Math.abs(clearedRefunds) - Math.abs(clearedFees);

    // ── In Transit ───────────────────────────────────────────────────────────
    // pending payouts + reserve_release events with expected_date > now
    const inTransit = await financialEventsRepository.sumAmounts(
      merchantId,
      ["payout", "reserve_release"],
      "pending",
      undefined,
      undefined,
      now
    );

    // ── Average Daily Inflow (last 30 days) ──────────────────────────────────
    const [sales30, refunds30, fees30] = await Promise.all([
      financialEventsRepository.sumAmounts(
        merchantId,
        ["sale"],
        undefined,
        thirtyDaysAgo,
        now
      ),
      financialEventsRepository.sumAmounts(
        merchantId,
        ["refund"],
        undefined,
        thirtyDaysAgo,
        now
      ),
      financialEventsRepository.sumAmounts(
        merchantId,
        ["fee"],
        undefined,
        thirtyDaysAgo,
        now
      ),
    ]);

    const netInflow30 = sales30 - Math.abs(refunds30) - Math.abs(fees30);
    const avgDailyInflow = netInflow30 / 30;

    // ── 14-Day Forecast ───────────────────────────────────────────────────────
    const forecast14d = avgDailyInflow * 14;

    // ── Merchant Expenses ─────────────────────────────────────────────────────
    const [settings] = await db
      .select()
      .from(merchantFinancialSettings)
      .where(eq(merchantFinancialSettings.merchantId, merchantId));

    const monthlyExpenses = settings
      ? parseFloat(settings.monthlyExpenses)
      : 0;
    const avgDailyExpenses = monthlyExpenses / 30;

    return {
      availableToday: round(availableToday),
      inTransit: round(inTransit),
      forecast14d: round(forecast14d),
      avgDailyInflow: round(avgDailyInflow),
      avgDailyExpenses: round(avgDailyExpenses),
    };
  }
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

export const cashflowService = new CashflowService();
