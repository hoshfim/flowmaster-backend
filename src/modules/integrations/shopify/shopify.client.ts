import { env } from "../../../config/env.js";

export interface ShopifyOrder {
  id: string;
  created_at: string;
  total_price: string;
  currency: string;
  financial_status: string;
  refunds: ShopifyRefund[];
}

export interface ShopifyRefund {
  id: string;
  created_at: string;
  transactions: ShopifyTransaction[];
}

export interface ShopifyTransaction {
  id: string;
  amount: string;
  currency: string;
  kind: string;
  status: string;
}

export interface ShopifyPayout {
  id: string;
  date: string;
  currency: string;
  amount: string;
  status: "scheduled" | "in_transit" | "paid" | "failed" | "cancelled";
  summary: {
    adjustments_fee_amount: string;
    charges_fee_amount: string;
    refunds_fee_amount: string;
    reserved_funds_fee_amount: string;
    total_charges: string;
    total_refunds: string;
  };
  payout_date?: string;
}

export class ShopifyClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(storeDomain?: string, accessToken?: string) {
    const domain = storeDomain ?? env.SHOPIFY_STORE_DOMAIN ?? "placeholder.myshopify.com";
    const token = accessToken ?? env.SHOPIFY_ACCESS_TOKEN ?? "";
    this.baseUrl = `https://${domain}/admin/api/2024-01`;
    this.accessToken = token;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Shopify API error: ${response.status} ${response.statusText} for ${path}`
      );
    }

    return response.json() as Promise<T>;
  }

  async getOrders(sinceId?: string): Promise<ShopifyOrder[]> {
    const params: Record<string, string> = {
      limit: "250",
      status: "any",
    };
    if (sinceId) params.since_id = sinceId;

    const data = await this.get<{ orders: ShopifyOrder[] }>("/orders.json", params);
    return data.orders;
  }

  async getPayouts(sinceId?: string): Promise<ShopifyPayout[]> {
    const params: Record<string, string> = { limit: "250" };
    if (sinceId) params.since_id = sinceId;

    const data = await this.get<{ payouts: ShopifyPayout[] }>(
      "/shopify_payments/payouts.json",
      params
    );
    return data.payouts;
  }
}

export const shopifyClient = new ShopifyClient();
