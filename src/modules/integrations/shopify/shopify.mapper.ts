import type { NewFinancialEvent } from "../../../db/schema.js";
import type {
  ShopifyOrder,
  ShopifyPayout,
} from "./shopify.client.js";

/**
 * Maps Shopify Orders → financial_events (sale + refund records).
 */
export function mapShopifyOrdersToEvents(
  merchantId: string,
  orders: ShopifyOrder[]
): NewFinancialEvent[] {
  const events: NewFinancialEvent[] = [];

  for (const order of orders) {
    const orderDate = new Date(order.created_at);

    // ── Sale event ───────────────────────────────────────────────────────────
    events.push({
      merchantId,
      platform: "shopify",
      eventType: "sale",
      amount: order.total_price,
      currency: order.currency,
      status: "pending", // orders are pending until payout
      eventDate: orderDate,
      metadata: {
        shopify_order_id: order.id,
        financial_status: order.financial_status,
      },
    });

    // ── Refund events ────────────────────────────────────────────────────────
    for (const refund of order.refunds ?? []) {
      for (const tx of refund.transactions ?? []) {
        if (tx.kind !== "refund") continue;

        events.push({
          merchantId,
          platform: "shopify",
          eventType: "refund",
          // Negative amount represents money leaving the merchant
          amount: `-${tx.amount}`,
          currency: tx.currency,
          status: "cleared", // refunds post immediately
          eventDate: new Date(refund.created_at),
          metadata: {
            shopify_order_id: order.id,
            shopify_refund_id: refund.id,
            shopify_transaction_id: tx.id,
          },
        });
      }
    }
  }

  return events;
}

/**
 * Maps Shopify Payouts → financial_events (payout + fee records).
 */
export function mapShopifyPayoutsToEvents(
  merchantId: string,
  payouts: ShopifyPayout[]
): NewFinancialEvent[] {
  const events: NewFinancialEvent[] = [];

  for (const payout of payouts) {
    const status =
      payout.status === "paid" ? "cleared" : "pending";

    // ── Payout event ─────────────────────────────────────────────────────────
    events.push({
      merchantId,
      platform: "shopify",
      eventType: "payout",
      amount: payout.amount,
      currency: payout.currency,
      status,
      eventDate: new Date(payout.date),
      expectedDate: payout.payout_date ? new Date(payout.payout_date) : undefined,
      metadata: {
        shopify_payout_id: payout.id,
        payout_status: payout.status,
        summary: payout.summary,
      },
    });

    // ── Fee event ─────────────────────────────────────────────────────────────
    // Aggregate all fees from the payout summary into one fee record
    const totalFees =
      parseFloat(payout.summary.adjustments_fee_amount ?? "0") +
      parseFloat(payout.summary.charges_fee_amount ?? "0") +
      parseFloat(payout.summary.refunds_fee_amount ?? "0") +
      parseFloat(payout.summary.reserved_funds_fee_amount ?? "0");

    if (totalFees > 0) {
      events.push({
        merchantId,
        platform: "shopify",
        eventType: "fee",
        amount: `-${totalFees.toFixed(4)}`,
        currency: payout.currency,
        status,
        eventDate: new Date(payout.date),
        metadata: {
          shopify_payout_id: payout.id,
          fee_breakdown: payout.summary,
        },
      });
    }
  }

  return events;
}
