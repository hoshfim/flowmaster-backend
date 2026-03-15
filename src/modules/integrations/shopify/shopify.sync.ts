import { shopifyClient } from "./shopify.client.js";
import {
  mapShopifyOrdersToEvents,
  mapShopifyPayoutsToEvents,
} from "./shopify.mapper.js";
import { financialEventsService } from "../../finance/financial-events.service.js";

export class ShopifySync {
  /**
   * Sync using credentials from the marketplace_connections table.
   * Called by MarketplaceService.triggerSync() at runtime.
   */
  async syncMerchantWithCredentials(
    merchantId: string,
    credentials: Record<string, string>
  ): Promise<void> {
    const client = new ShopifyClient(
      credentials.storeDomain ?? "",
      credentials.accessToken ?? ""
    );
    await this._sync(merchantId, client);
  }

  /**
   * Sync using env-var credentials (legacy / dev convenience).
   */
  async syncMerchant(merchantId: string): Promise<void> {
    await this._sync(merchantId, shopifyClient);
  }

  private async _sync(merchantId: string, client: ShopifyClient): Promise<void> {
    console.log(`[ShopifySync] Starting sync for merchant ${merchantId}`);

    try {
      const orders = await client.getOrders();
      const orderEvents = mapShopifyOrdersToEvents(merchantId, orders);
      await financialEventsService.ingestEvents(orderEvents);
      console.log(`[ShopifySync] ${orders.length} orders → ${orderEvents.length} events`);

      const payouts = await client.getPayouts();
      const payoutEvents = mapShopifyPayoutsToEvents(merchantId, payouts);
      await financialEventsService.ingestEvents(payoutEvents);
      console.log(`[ShopifySync] ${payouts.length} payouts → ${payoutEvents.length} events`);
    } catch (err) {
      console.error(`[ShopifySync] Sync failed for merchant ${merchantId}:`, err);
      throw err;
    }
  }
}

export const shopifySync = new ShopifySync();
