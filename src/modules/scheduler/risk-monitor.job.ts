import cron from "node-cron";
import { db } from "../../db/client.js";
import { merchants, riskSnapshots } from "../../db/schema.js";
import { cashflowService } from "../cashflow/cashflow.service.js";
import { evaluateRisk } from "../cashflow/risk-engine.js";
import type { RiskLevel } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";

// ─── Alerts ───────────────────────────────────────────────────────────────────

async function sendEmailAlert(merchantId: string, email: string, warnings: string[]): Promise<void> {
  console.log(`[Alert:Email] merchant=${merchantId} email=${email} warnings=${JSON.stringify(warnings)}`);
  // TODO: implement with @sendgrid/mail or nodemailer using SMTP_* env vars
}

async function sendInAppNotification(merchantId: string, riskLevel: RiskLevel, warnings: string[]): Promise<void> {
  console.log(`[Alert:InApp] merchant=${merchantId} riskLevel=${riskLevel} warnings=${JSON.stringify(warnings)}`);
  // TODO: insert into a notifications table / push to websocket
}

// ─── Per-merchant evaluation ──────────────────────────────────────────────────

async function evaluateMerchant(merchantId: string, email: string): Promise<void> {
  try {
    const summary = await cashflowService.getMerchantSummary(merchantId);
    const risk    = evaluateRisk(summary);

    // Persist snapshot
    await db.insert(riskSnapshots).values({
      merchantId,
      riskLevel:        risk.riskLevel,
      cashCoverageDays: risk.cashCoverageDays.toFixed(2),
      availableToday:   summary.availableToday.toFixed(4),
      inTransit:        summary.inTransit.toFixed(4),
      forecast14d:      summary.forecast14d.toFixed(4),
      warnings:         risk.warnings,
    });

    // Detect medium → high escalation
    const history = await db
      .select()
      .from(riskSnapshots)
      .where(eq(riskSnapshots.merchantId, merchantId))
      .orderBy(desc(riskSnapshots.evaluatedAt))
      .limit(2);

    const previous = history[1];
    if (previous?.riskLevel === "medium" && risk.riskLevel === "high") {
      console.log(`[RiskMonitor] ⚠️  Merchant ${merchantId} escalated: medium → high`);
      await Promise.all([
        sendEmailAlert(merchantId, email, risk.warnings),
        sendInAppNotification(merchantId, risk.riskLevel, risk.warnings),
      ]);
    }

    console.log(`[RiskMonitor] merchant=${merchantId} risk=${risk.riskLevel} coverage=${risk.cashCoverageDays}d`);
  } catch (err) {
    console.error(`[RiskMonitor] Failed for merchant ${merchantId}:`, err);
  }
}

// ─── Cron job ─────────────────────────────────────────────────────────────────

export function startRiskMonitor(): void {
  // Daily at 06:00 UTC
  cron.schedule("0 6 * * *", async () => {
    console.log("[RiskMonitor] Starting daily risk evaluation…");
    const start = Date.now();

    try {
      // Query merchants table directly — authoritative source of all merchant IDs
      const activeMerchants = await db
        .select({ id: merchants.id, email: merchants.email })
        .from(merchants)
        .where(eq(merchants.isActive, true));

      console.log(`[RiskMonitor] Evaluating ${activeMerchants.length} active merchants`);

      for (const m of activeMerchants) {
        await evaluateMerchant(m.id, m.email);
      }

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[RiskMonitor] Completed in ${elapsed}s`);
    } catch (err) {
      console.error("[RiskMonitor] Fatal job error:", err);
    }
  });

  console.log("[RiskMonitor] Scheduled — runs daily at 06:00 UTC");
}

export async function runRiskMonitorNow(): Promise<void> {
  console.log("[RiskMonitor] Manual run triggered");
  const activeMerchants = await db
    .select({ id: merchants.id, email: merchants.email })
    .from(merchants)
    .where(eq(merchants.isActive, true));

  for (const m of activeMerchants) {
    await evaluateMerchant(m.id, m.email);
  }
}
