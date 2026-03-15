import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db/client.js";
import { marketplaceConnections } from "../../../db/schema.js";
import type {
  MarketplaceConnection,
  NewMarketplaceConnection,
} from "../../../db/schema.js";
import {
  encryptCredentials,
  decryptCredentials,
  maskCredential,
} from "./credentials.js";
import {
  getPlatformDef,
  SUPPORTED_PLATFORM_IDS,
} from "./platform-registry.js";
import { shopifySync } from "../shopify/shopify.sync.js";
import { tiktokSync } from "../tiktok/tiktok.sync.js";

// ─── Validation ───────────────────────────────────────────────────────────────

export const createConnectionSchema = z.object({
  platform: z.string().refine((v) => SUPPORTED_PLATFORM_IDS.includes(v), {
    message: `platform must be one of: ${SUPPORTED_PLATFORM_IDS.join(", ")}`,
  }),
  displayName: z.string().min(1).max(255),
  credentials: z.record(z.string(), z.string()),
});

export const updateConnectionSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateConnectionPayload = z.infer<typeof createConnectionSchema>;
export type UpdateConnectionPayload = z.infer<typeof updateConnectionSchema>;

// ─── Safe public type (no encrypted credentials) ─────────────────────────────

export interface ConnectionView {
  id: string;
  merchantId: string;
  platform: string;
  displayName: string;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Masked credential keys (for UI "connected" confirmation – never values)
  credentialKeys: string[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class MarketplaceService {
  // ── List ──────────────────────────────────────────────────────────────────

  async listConnections(merchantId: string): Promise<ConnectionView[]> {
    const rows = await db
      .select()
      .from(marketplaceConnections)
      .where(eq(marketplaceConnections.merchantId, merchantId))
      .orderBy(marketplaceConnections.createdAt);

    return rows.map(toView);
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getConnection(
    merchantId: string,
    connectionId: string
  ): Promise<ConnectionView | null> {
    const [row] = await db
      .select()
      .from(marketplaceConnections)
      .where(
        and(
          eq(marketplaceConnections.merchantId, merchantId),
          eq(marketplaceConnections.id, connectionId)
        )
      );
    return row ? toView(row) : null;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createConnection(
    merchantId: string,
    payload: CreateConnectionPayload
  ): Promise<ConnectionView> {
    // Validate that required credential fields are present
    const def = getPlatformDef(payload.platform);
    if (!def) throw new Error(`Unknown platform: ${payload.platform}`);

    const missingFields = def.fields
      .filter((f) => f.required && !payload.credentials[f.key]?.trim())
      .map((f) => f.key);

    if (missingFields.length > 0) {
      throw new ValidationError(
        `Missing required credential fields: ${missingFields.join(", ")}`
      );
    }

    const credentialsEncrypted = encryptCredentials(payload.credentials);

    const record: NewMarketplaceConnection = {
      merchantId,
      platform: payload.platform,
      displayName: payload.displayName,
      credentialsEncrypted,
      isActive: true,
      syncStatus: "pending",
    };

    const [row] = await db
      .insert(marketplaceConnections)
      .values(record)
      .returning();

    return toView(row);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateConnection(
    merchantId: string,
    connectionId: string,
    payload: UpdateConnectionPayload
  ): Promise<ConnectionView> {
    const existing = await this._getRowOrThrow(merchantId, connectionId);

    const updates: Partial<MarketplaceConnection> = {
      updatedAt: new Date(),
    };

    if (payload.displayName !== undefined) {
      updates.displayName = payload.displayName;
    }

    if (payload.isActive !== undefined) {
      updates.isActive = payload.isActive;
    }

    if (payload.credentials !== undefined) {
      // Merge new credentials over existing ones
      const existingCreds = decryptCredentials(existing.credentialsEncrypted);
      const merged = { ...existingCreds, ...payload.credentials };
      updates.credentialsEncrypted = encryptCredentials(merged);
    }

    const [updated] = await db
      .update(marketplaceConnections)
      .set(updates)
      .where(
        and(
          eq(marketplaceConnections.merchantId, merchantId),
          eq(marketplaceConnections.id, connectionId)
        )
      )
      .returning();

    return toView(updated);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteConnection(merchantId: string, connectionId: string): Promise<void> {
    await this._getRowOrThrow(merchantId, connectionId); // 404 guard

    await db
      .delete(marketplaceConnections)
      .where(
        and(
          eq(marketplaceConnections.merchantId, merchantId),
          eq(marketplaceConnections.id, connectionId)
        )
      );
  }

  // ── Trigger Sync ──────────────────────────────────────────────────────────

  async triggerSync(merchantId: string, connectionId: string): Promise<void> {
    const row = await this._getRowOrThrow(merchantId, connectionId);

    if (!row.isActive) {
      throw new Error("Cannot sync an inactive connection");
    }

    // Mark as syncing
    await db
      .update(marketplaceConnections)
      .set({ syncStatus: "syncing", updatedAt: new Date() })
      .where(eq(marketplaceConnections.id, connectionId));

    // Dispatch to the correct adapter (async – runs in background)
    this._runSync(row).catch(async (err) => {
      await db
        .update(marketplaceConnections)
        .set({
          syncStatus: "error",
          lastSyncError: String(err),
          updatedAt: new Date(),
        })
        .where(eq(marketplaceConnections.id, connectionId));
    });
  }

  private async _runSync(row: MarketplaceConnection): Promise<void> {
    const credentials = decryptCredentials(row.credentialsEncrypted);

    switch (row.platform) {
      case "shopify":
        await shopifySync.syncMerchantWithCredentials(
          row.merchantId,
          credentials
        );
        break;

      case "tiktok":
        await tiktokSync.syncMerchantWithCredentials(
          row.merchantId,
          credentials
        );
        break;

      default:
        throw new Error(
          `No sync adapter registered for platform: ${row.platform}`
        );
    }

    // Mark sync as successful
    await db
      .update(marketplaceConnections)
      .set({
        syncStatus: "ok",
        lastSyncedAt: new Date(),
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceConnections.id, row.id));
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  private async _getRowOrThrow(
    merchantId: string,
    connectionId: string
  ): Promise<MarketplaceConnection> {
    const [row] = await db
      .select()
      .from(marketplaceConnections)
      .where(
        and(
          eq(marketplaceConnections.merchantId, merchantId),
          eq(marketplaceConnections.id, connectionId)
        )
      );

    if (!row) {
      throw new NotFoundError(
        `Connection ${connectionId} not found for merchant ${merchantId}`
      );
    }

    return row;
  }
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toView(row: MarketplaceConnection): ConnectionView {
  // Decrypt just enough to reveal which keys are configured (not values)
  let credentialKeys: string[] = [];
  try {
    const creds = decryptCredentials(row.credentialsEncrypted);
    credentialKeys = Object.keys(creds).filter((k) => !!creds[k]);
  } catch {
    // If decryption fails for any reason, return empty keys
  }

  return {
    id: row.id,
    merchantId: row.merchantId,
    platform: row.platform,
    displayName: row.displayName,
    isActive: row.isActive,
    syncStatus: row.syncStatus,
    lastSyncedAt: row.lastSyncedAt,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    credentialKeys,
  };
}

export const marketplaceService = new MarketplaceService();
