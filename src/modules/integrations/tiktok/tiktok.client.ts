import { env } from "../../../config/env.js";
import crypto from "node:crypto";

// ─── TikTok Shop API Response Shapes ─────────────────────────────────────────

export interface TikTokApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

export interface TikTokOrderSettlement {
  order_id: string;
  settlement_time: string;
  settlement_amount: string;
  currency: string;
  settlement_type: "sale" | "refund" | "fee";
  fee_amount?: string;
}

export interface TikTokPayout {
  payout_id: string;
  payout_date: string;
  currency: string;
  amount: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
}

export interface TikTokSettlement {
  settlement_id: string;
  settlement_type: "reserve_increase" | "reserve_release";
  currency: string;
  amount: string;
  expected_release_date?: string;
  created_at: string;
}

export class TikTokClient {
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(
    appKey?: string,
    appSecret?: string,
    accessToken?: string,
    baseUrl?: string
  ) {
    this.appKey = appKey ?? env.TIKTOK_APP_KEY ?? "";
    this.appSecret = appSecret ?? env.TIKTOK_APP_SECRET ?? "";
    this.accessToken = accessToken ?? env.TIKTOK_ACCESS_TOKEN ?? "";
    this.baseUrl = baseUrl ?? env.TIKTOK_API_BASE;
  }

  /**
   * Generate HMAC-SHA256 signature required by TikTok Shop API.
   */
  private sign(
    path: string,
    params: Record<string, string>,
    timestamp: string
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("");

    const toSign = `${this.appSecret}${path}${sortedParams}${timestamp}${this.appSecret}`;

    return crypto.createHmac("sha256", this.appSecret).update(toSign).digest("hex");
  }

  private async get<T>(
    path: string,
    queryParams: Record<string, string> = {}
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const params: Record<string, string> = {
      app_key: this.appKey,
      access_token: this.accessToken,
      timestamp,
      ...queryParams,
    };

    const sign = this.sign(path, params, timestamp);
    params.sign = sign;

    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const response = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `TikTok API error: ${response.status} ${response.statusText} for ${path}`
      );
    }

    const json = (await response.json()) as TikTokApiResponse<T>;

    if (json.code !== 0) {
      throw new Error(
        `TikTok API logical error ${json.code}: ${json.message} (request_id: ${json.request_id})`
      );
    }

    return json.data;
  }

  async getOrderSettlements(
    startTime?: string,
    endTime?: string
  ): Promise<TikTokOrderSettlement[]> {
    const params: Record<string, string> = { page_size: "100" };
    if (startTime) params.start_time = startTime;
    if (endTime) params.end_time = endTime;

    return this.get<TikTokOrderSettlement[]>(
      "/api/v2/finance/order_settlements",
      params
    );
  }

  async getPayouts(startTime?: string, endTime?: string): Promise<TikTokPayout[]> {
    const params: Record<string, string> = { page_size: "100" };
    if (startTime) params.start_time = startTime;
    if (endTime) params.end_time = endTime;

    return this.get<TikTokPayout[]>("/api/v2/finance/payouts", params);
  }

  async getSettlements(
    startTime?: string,
    endTime?: string
  ): Promise<TikTokSettlement[]> {
    const params: Record<string, string> = { page_size: "100" };
    if (startTime) params.start_time = startTime;
    if (endTime) params.end_time = endTime;

    return this.get<TikTokSettlement[]>("/api/v2/finance/settlements", params);
  }
}

export const tiktokClient = new TikTokClient();
