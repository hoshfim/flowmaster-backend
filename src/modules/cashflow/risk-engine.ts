import type { CashflowSummary } from "./cashflow.service.js";
import type { RiskLevel } from "../../db/schema.js";

export interface RiskEvaluation {
  riskLevel: RiskLevel;
  cashCoverageDays: number;
  warnings: string[];
}

/**
 * Pure function – no I/O. Evaluates liquidity risk from a cashflow summary.
 */
export function evaluateRisk(summary: CashflowSummary): RiskEvaluation {
  const { availableToday, inTransit, avgDailyExpenses, forecast14d } = summary;

  const warnings: string[] = [];

  // ── Cash Coverage ─────────────────────────────────────────────────────────
  // Guard against division by zero when a merchant hasn't configured expenses
  const cashCoverageDays =
    avgDailyExpenses > 0 ? availableToday / avgDailyExpenses : Infinity;

  // ── Risk Classification ───────────────────────────────────────────────────
  let riskLevel: RiskLevel;

  if (availableToday < 0 || cashCoverageDays < 7) {
    riskLevel = "high";

    const coverageDaysDisplay = isFinite(cashCoverageDays)
      ? cashCoverageDays.toFixed(1)
      : "∞";

    warnings.push(
      `Your current cash only covers ${coverageDaysDisplay} days of expenses.`
    );

    if (inTransit > 0) {
      warnings.push("Consider requesting an early payout.");
    }

    if (availableToday < 0) {
      warnings.push(
        `Your available balance is negative ($${Math.abs(availableToday).toFixed(2)}). Immediate action required.`
      );
    }
  } else if (cashCoverageDays < 14) {
    riskLevel = "medium";
    warnings.push("You have limited liquidity coverage.");
  } else {
    // cashCoverageDays >= 14 – check 14-day forecast solvency
    const totalAvailable = availableToday + inTransit;
    if (totalAvailable >= forecast14d) {
      riskLevel = "low";
      warnings.push("You are in a healthy cash position.");
    } else {
      // Edge case: coverage days look ok but projected inflow won't cover forecast
      riskLevel = "medium";
      warnings.push(
        "Projected 14-day inflow may not cover forecasted needs. Monitor closely."
      );
    }
  }

  return {
    riskLevel,
    cashCoverageDays: isFinite(cashCoverageDays)
      ? parseFloat(cashCoverageDays.toFixed(2))
      : 9999, // represents "no expenses configured"
    warnings,
  };
}

/**
 * Calculate recommended liquidity advance when risk is high and funds are in transit.
 *
 * needed       = (avgDailyExpenses × 14) − availableToday
 * recommended  = MIN(needed, inTransit)
 */
export function calcRecommendedLiquidity(
  summary: CashflowSummary,
  risk: RiskEvaluation
): number {
  if (risk.riskLevel !== "high" || summary.inTransit <= 0) return 0;

  const needed = summary.avgDailyExpenses * 14 - summary.availableToday;
  if (needed <= 0) return 0;

  return parseFloat(Math.min(needed, summary.inTransit).toFixed(2));
}
