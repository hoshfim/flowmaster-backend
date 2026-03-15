import { tiktokClient } from "./tiktok.client.js";
import {
  mapTikTokOrderSettlements,
  mapTikTokPayouts,
  mapTikTokSettlements,
} from "./tiktok.mapper.js";
import { financialEventsService } from "../../finance/financial-events.service.js";

export class TikTokSync {
  /**
   * Sync using credentials from the marketplace_connections table.
   */
  async syncMerchantWithCredentials(
    merchantId: string,
    credentials: Record<string, string>
  ): Promise<void> {
    const client = new TikTokClient(
      credentials.appKey,
      credentials.appSecret,
      credentials.accessToken
    );
    await this._sync(merchantId, client);
  }

  /**
   * Sync using env-var credentials (legacy / dev convenience).
   */
  async syncMerchant(
    merchantId: string,
    startTime?: string,
    endTime?: string
  ): Promise<void> {
    await this._sync(merchantId, tiktokClient, startTime, endTime);
  }

  private async _sync(
    merchantId: string,
    client: TikTokClient,
    startTime?: string,
    endTime?: string
  ): Promise<void> {
    console.log(`[TikTokSync] Starting sync for merchant ${merchantId}`);

    try {
      const orderSettlements = await client.getOrderSettlements(startTime, endTime);
      const orderEvents = mapTikTokOrderSettlements(merchantId, orderSettlements);
      await financialEventsService.ingestEvents(orderEvents);
      console.log(`[TikTokSync] ${orderSettlements.length} order settlements → ${orderEvents.length} events`);

      const payouts = await client.getPayouts(startTime, endTime);
      const payoutEvents = mapTikTokPayouts(merchantId, payouts);
      await financialEventsService.ingestEvents(payoutEvents);
      console.log(`[TikTokSync] ${payouts.length} payouts → ${payoutEvents.length} events`);

      const settlements = await client.getSettlements(startTime, endTime);
      const settlementEvents = mapTikTokSettlements(merchantId, settlements);
      await financialEventsService.ingestEvents(settlementEvents);
      console.log(`[TikTokSync] ${settlements.length} reserve settlements → ${settlementEvents.length} events`);
    } catch (err) {
      console.error(`[TikTokSync] Sync failed for merchant ${merchantId}:`, err);
      throw err;
    }
  }
}

export const tiktokSync = new TikTokSync();
