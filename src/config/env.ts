import { z } from "zod";
import { config } from "dotenv";

config();

const envSchema = z.object({
  PORT:     z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  JWT_ACCESS_SECRET:  z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 chars"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 chars"),
  JWT_ACCESS_EXPIRES:  z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("30d"),

  // ── Encryption (marketplace credentials at rest) ──────────────────────────
  // Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Accepts any hex string of 64+ characters (32+ bytes).
  // randomBytes(64).toString('hex') = 128 chars — also accepted, first 32 bytes used.
  ENCRYPTION_KEY: z
    .string()
    .min(64, "ENCRYPTION_KEY must be at least 64 hex characters (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"")
    .refine(
      (v) => /^[0-9a-fA-F]+$/.test(v),
      "ENCRYPTION_KEY must only contain hex characters (0-9, a-f)"
    )
    .optional(),

  // ── Platform integrations (optional legacy fallbacks) ─────────────────────
  SHOPIFY_API_KEY:      z.string().optional(),
  SHOPIFY_API_SECRET:   z.string().optional(),
  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  SHOPIFY_ACCESS_TOKEN: z.string().optional(),

  TIKTOK_APP_KEY:      z.string().optional(),
  TIKTOK_APP_SECRET:   z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  TIKTOK_API_BASE:     z.string().url().default("https://open-api.tiktokglobalshop.com"),

  // ── Alerts ────────────────────────────────────────────────────────────────
  SMTP_HOST:        z.string().optional(),
  SMTP_PORT:        z.coerce.number().default(587),
  SMTP_USER:        z.string().optional(),
  SMTP_PASS:        z.string().optional(),
  ALERT_FROM_EMAIL: z.string().email().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
