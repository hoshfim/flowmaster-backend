import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  financialEvents,
  type NewFinancialEvent,
  type FinancialEvent,
  type EventStatus,
  type EventType,
} from "../../db/schema.js";

export interface EventFilterOptions {
  merchantId: string;
  status?: EventStatus | EventStatus[];
  eventTypes?: EventType[];
  fromDate?: Date;
  toDate?: Date;
  expectedAfter?: Date;
}

export class FinancialEventsRepository {
  /**
   * Insert a single financial event.
   */
  async create(event: NewFinancialEvent): Promise<FinancialEvent> {
    const [row] = await db.insert(financialEvents).values(event).returning();
    return row;
  }

  /**
   * Bulk insert financial events – used by platform sync jobs.
   */
  async createMany(events: NewFinancialEvent[]): Promise<void> {
    if (events.length === 0) return;

    // Insert in chunks of 500 to stay within Neon payload limits
    const CHUNK_SIZE = 500;
    for (let i = 0; i < events.length; i += CHUNK_SIZE) {
      const chunk = events.slice(i, i + CHUNK_SIZE);
      await db.insert(financialEvents).values(chunk).onConflictDoNothing();
    }
  }

  /**
   * Fetch events matching filter criteria.
   */
  async findMany(filters: EventFilterOptions): Promise<FinancialEvent[]> {
    const conditions = [eq(financialEvents.merchantId, filters.merchantId)];

    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      conditions.push(inArray(financialEvents.status, statuses));
    }

    if (filters.eventTypes && filters.eventTypes.length > 0) {
      conditions.push(inArray(financialEvents.eventType, filters.eventTypes));
    }

    if (filters.fromDate) {
      conditions.push(gte(financialEvents.eventDate, filters.fromDate));
    }

    if (filters.toDate) {
      conditions.push(lte(financialEvents.eventDate, filters.toDate));
    }

    if (filters.expectedAfter) {
      conditions.push(
        gte(financialEvents.expectedDate, filters.expectedAfter)
      );
    }

    return db
      .select()
      .from(financialEvents)
      .where(and(...conditions))
      .orderBy(financialEvents.eventDate);
  }

  /**
   * Aggregate sum of amounts for a set of event types + status.
   * Returns 0 if no rows match.
   */
  async sumAmounts(
    merchantId: string,
    eventTypes: EventType[],
    status?: EventStatus,
    fromDate?: Date,
    toDate?: Date,
    expectedAfter?: Date
  ): Promise<number> {
    const conditions = [
      eq(financialEvents.merchantId, merchantId),
      inArray(financialEvents.eventType, eventTypes),
    ];

    if (status) {
      conditions.push(eq(financialEvents.status, status));
    }

    if (fromDate) {
      conditions.push(gte(financialEvents.eventDate, fromDate));
    }

    if (toDate) {
      conditions.push(lte(financialEvents.eventDate, toDate));
    }

    if (expectedAfter) {
      conditions.push(gte(financialEvents.expectedDate, expectedAfter));
    }

    const [result] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${financialEvents.amount}), 0)`,
      })
      .from(financialEvents)
      .where(and(...conditions));

    return parseFloat(result?.total ?? "0");
  }

  /**
   * Get all unique merchant IDs in the system.
   */
  async getDistinctMerchantIds(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ merchantId: financialEvents.merchantId })
      .from(financialEvents);
    return rows.map((r) => r.merchantId);
  }
}

export const financialEventsRepository = new FinancialEventsRepository();
