import type { NewFinancialEvent } from "../../db/schema.js";
import { financialEventsRepository } from "./financial-events.repository.js";

export class FinancialEventsService {
  /**
   * Ingest a batch of normalized financial events from any platform adapter.
   * This is the single entry-point for all platform data.
   */
  async ingestEvents(events: NewFinancialEvent[]): Promise<void> {
    if (events.length === 0) return;
    await financialEventsRepository.createMany(events);
    console.log(
      `[FinancialEventsService] Ingested ${events.length} events for merchant ${events[0]?.merchantId}`
    );
  }

  async getEventsForMerchant(merchantId: string, fromDate?: Date) {
    return financialEventsRepository.findMany({ merchantId, fromDate });
  }
}

export const financialEventsService = new FinancialEventsService();
