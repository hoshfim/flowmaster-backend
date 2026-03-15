import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Platform = "shopify" | "tiktok" | "amazon" | "manual";
export type EventType =
  | "sale"
  | "refund"
  | "fee"
  | "payout"
  | "reserve_increase"
  | "reserve_release";
export type EventStatus = "pending" | "cleared";
export type RiskLevel = "low" | "medium" | "high";

// ─── merchants ────────────────────────────────────────────────────────────────

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({ emailIdx: uniqueIndex("merchants_email_idx").on(t.email) })
);

// ─── refresh_tokens ───────────────────────────────────────────────────────────

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: varchar("user_agent", { length: 512 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    merchantIdx:  index("rt_merchant_id_idx").on(t.merchantId),
    tokenHashIdx: uniqueIndex("rt_token_hash_idx").on(t.tokenHash),
    expiresIdx:   index("rt_expires_at_idx").on(t.expiresAt),
  })
);

// ─── financial_events ─────────────────────────────────────────────────────────

export const financialEvents = pgTable(
  "financial_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull().$type<Platform>(),
    eventType: varchar("event_type", { length: 32 }).notNull().$type<EventType>(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("USD"),
    status: varchar("status", { length: 16 }).notNull().$type<EventStatus>(),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    expectedDate: timestamp("expected_date", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    merchantIdIdx:   index("fe_merchant_id_idx").on(t.merchantId),
    eventDateIdx:    index("fe_event_date_idx").on(t.eventDate),
    expectedDateIdx: index("fe_expected_date_idx").on(t.expectedDate),
    statusIdx:       index("fe_status_idx").on(t.status),
    platformIdx:     index("fe_platform_idx").on(t.platform),
    merchantDateIdx: index("fe_merchant_date_idx").on(t.merchantId, t.eventDate),
  })
);

// ─── merchant_financial_settings ─────────────────────────────────────────────

export const merchantFinancialSettings = pgTable("merchant_financial_settings", {
  merchantId: uuid("merchant_id").primaryKey().references(() => merchants.id, { onDelete: "cascade" }),
  monthlyExpenses: numeric("monthly_expenses", { precision: 18, scale: 4 }).notNull().default("0"),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ─── risk_snapshots ───────────────────────────────────────────────────────────

export const riskSnapshots = pgTable(
  "risk_snapshots",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    riskLevel: varchar("risk_level", { length: 16 }).notNull().$type<RiskLevel>(),
    cashCoverageDays: numeric("cash_coverage_days", { precision: 10, scale: 2 }).notNull(),
    availableToday: numeric("available_today", { precision: 18, scale: 4 }).notNull(),
    inTransit: numeric("in_transit", { precision: 18, scale: 4 }).notNull(),
    forecast14d: numeric("forecast_14d", { precision: 18, scale: 4 }).notNull(),
    warnings: jsonb("warnings").$type<string[]>(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    merchantIdIdx:  index("rs_merchant_id_idx").on(t.merchantId),
    evaluatedAtIdx: index("rs_evaluated_at_idx").on(t.evaluatedAt),
  })
);

// ─── liquidity_requests ───────────────────────────────────────────────────────

export const liquidityRequests = pgTable(
  "liquidity_requests",
  {
    id: uuid("id").primaryKey(),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    companyId: varchar("company_id", { length: 128 }).notNull(),
    avgMonthlyRevenue: numeric("avg_monthly_revenue", { precision: 18, scale: 4 }).notNull(),
    riskScore: numeric("risk_score", { precision: 5, scale: 2 }).notNull(),
    cashCoverageDays: numeric("cash_coverage_days", { precision: 10, scale: 2 }).notNull(),
    inTransitFunds: numeric("in_transit_funds", { precision: 18, scale: 4 }).notNull(),
    amountToLiquidate: numeric("amount_to_liquidate", { precision: 18, scale: 4 }).notNull(),
    platformFee: numeric("platform_fee", { precision: 18, scale: 4 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({ merchantIdIdx: index("lr_merchant_id_idx").on(t.merchantId) })
);

// ─── marketplace_connections ──────────────────────────────────────────────────

export const marketplaceConnections = pgTable(
  "marketplace_connections",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    credentialsEncrypted: varchar("credentials_encrypted", { length: 8192 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncError: varchar("last_sync_error", { length: 2048 }),
    syncStatus: varchar("sync_status", { length: 32 }).notNull().default("never"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => ({
    mcMerchantIdx:         index("mc_merchant_id_idx").on(t.merchantId),
    mcPlatformIdx:         index("mc_platform_idx").on(t.platform),
    mcMerchantPlatformIdx: index("mc_merchant_platform_idx").on(t.merchantId, t.platform),
  })
);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type Merchant    = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;

export type RefreshToken    = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export type FinancialEvent    = typeof financialEvents.$inferSelect;
export type NewFinancialEvent = typeof financialEvents.$inferInsert;

export type MerchantFinancialSettings    = typeof merchantFinancialSettings.$inferSelect;
export type NewMerchantFinancialSettings = typeof merchantFinancialSettings.$inferInsert;

export type RiskSnapshot    = typeof riskSnapshots.$inferSelect;
export type NewRiskSnapshot = typeof riskSnapshots.$inferInsert;

export type LiquidityRequest    = typeof liquidityRequests.$inferSelect;
export type NewLiquidityRequest = typeof liquidityRequests.$inferInsert;

export type MarketplaceConnection    = typeof marketplaceConnections.$inferSelect;
export type NewMarketplaceConnection = typeof marketplaceConnections.$inferInsert;
