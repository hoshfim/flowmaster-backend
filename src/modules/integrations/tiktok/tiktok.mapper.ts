import type { NewFinancialEvent } from "../../../db/schema.js";
import type {
  TikTokOrderSettlement,
  TikTokPayout,
  TikTokSettlement,
} from "./tiktok.client.js";

/**
 * Maps TikTok order_settlements → sale / refund / fee events.
 */
export function mapTikTokOrderSettlements(
  merchantId: string,
  settlements: TikTokOrderSettlement[]
): NewFinancialEvent[] {
  return settlements.map((s): NewFinancialEvent => {
    const isDebit = s.settlement_type === "refund" || s.settlement_type === "fee";
    const amount = isDebit ? `-${s.settlement_amount}` : s.settlement_amount;

    return {
      merchantId,
      platform: "tiktok",
      eventType: s.settlement_type,
      amount,
      currency: s.currency,
      status: "cleared", // order settlements are already settled
      eventDate: new Date(parseInt(s.settlement_time, 10) * 1000),
      metadata: {
        tiktok_order_id: s.order_id,
        fee_amount: s.fee_amount,
      },
    };
  });
}

/**
 * Maps TikTok payouts → payout events.
 */
export function mapTikTokPayouts(
  merchantId: string,
  payouts: TikTokPayout[]
): NewFinancialEvent[] {
  return payouts.map((p): NewFinancialEvent => {
    const status = p.status === "PAID" ? "cleared" : "pending";
    const payoutDate = new Date(parseInt(p.payout_date, 10) * 1000);

    return {
      merchantId,
      platform: "tiktok",
      eventType: "payout",
      amount: p.amount,
      currency: p.currency,
      status,
      eventDate: payoutDate,
      expectedDate: status === "pending" ? payoutDate : undefined,
      metadata: {
        tiktok_payout_id: p.payout_id,
        tiktok_payout_status: p.status,
      },
    };
  });
}

/**
 * Maps TikTok reserve settlements → reserve_increase / reserve_release events.
 */
export function mapTikTokSettlements(
  merchantId: string,
  settlements: TikTokSettlement[]
): NewFinancialEvent[] {
  return settlements.map((s): NewFinancialEvent => {
    const isRelease = s.settlement_type === "reserve_release";
    const isIncrease = s.settlement_type === "reserve_increase";

    // Reserve increases are debits (held funds), releases are credits
    const amount = isIncrease ? `-${s.amount}` : s.amount;

    return {
      merchantId,
      platform: "tiktok",
      eventType: s.settlement_type,
      amount,
      currency: s.currency,
      status: isRelease ? "pending" : "cleared",
      eventDate: new Date(parseInt(s.created_at, 10) * 1000),
      expectedDate:
        isRelease && s.expected_release_date
          ? new Date(parseInt(s.expected_release_date, 10) * 1000)
          : undefined,
      metadata: {
        tiktok_settlement_id: s.settlement_id,
      },
    };
  });
}
