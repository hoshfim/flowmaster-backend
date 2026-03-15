import { eq, and, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../db/client.js";
import { merchants, refreshTokens } from "../../db/schema.js";
import type { Merchant } from "../../db/schema.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "./token.utils.js";

// ─── Validation schemas ───────────────────────────────────────────────────────

export const registerSchema = z.object({
  email:       z.string().email("Invalid email address"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(1, "Company name is required").max(255),
  fullName:    z.string().max(255).optional(),
});

export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export type RegisterPayload = z.infer<typeof registerSchema>;
export type LoginPayload    = z.infer<typeof loginSchema>;

// ─── Token pair response ──────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number; // seconds until access token expires
  merchant: {
    id:          string;
    email:       string;
    companyName: string;
    fullName:    string | null | undefined;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;

  // ── Register ───────────────────────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<AuthTokens> {
    // Check email uniqueness
    const existing = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.email, payload.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(payload.password, this.BCRYPT_ROUNDS);

    const [merchant] = await db
      .insert(merchants)
      .values({
        email:        payload.email.toLowerCase(),
        passwordHash,
        companyName:  payload.companyName,
        fullName:     payload.fullName,
        emailVerified: false,
        isActive:     true,
      })
      .returning();

    return this._issueTokens(merchant);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(
    payload: LoginPayload,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthTokens> {
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.email, payload.email.toLowerCase()))
      .limit(1);

    // Constant-time comparison even when merchant not found
    const hash = merchant?.passwordHash ?? "$2a$12$placeholder-hash-for-timing";
    const valid = await bcrypt.compare(payload.password, hash);

    if (!merchant || !valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!merchant.isActive) {
      throw new UnauthorizedError("Account is deactivated");
    }

    // Update lastLoginAt
    await db
      .update(merchants)
      .set({ lastLoginAt: new Date() })
      .where(eq(merchants.id, merchant.id));

    return this._issueTokens(merchant, meta);
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  async refresh(
    rawRefreshToken: string,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthTokens> {
    const hash = hashRefreshToken(rawRefreshToken);
    const now  = new Date();

    const [token] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, hash),
          gt(refreshTokens.expiresAt, now),
          isNull(refreshTokens.revokedAt)
        )
      )
      .limit(1);

    if (!token) {
      throw new UnauthorizedError("Refresh token is invalid or expired");
    }

    // Rotate: revoke old token immediately
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(eq(refreshTokens.id, token.id));

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, token.merchantId))
      .limit(1);

    if (!merchant || !merchant.isActive) {
      throw new UnauthorizedError("Account not found or deactivated");
    }

    return this._issueTokens(merchant, meta);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string): Promise<void> {
    const hash = hashRefreshToken(rawRefreshToken);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hash));
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  async getMe(merchantId: string) {
    const [merchant] = await db
      .select({
        id:            merchants.id,
        email:         merchants.email,
        companyName:   merchants.companyName,
        fullName:      merchants.fullName,
        emailVerified: merchants.emailVerified,
        createdAt:     merchants.createdAt,
        lastLoginAt:   merchants.lastLoginAt,
      })
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1);

    if (!merchant) throw new NotFoundError("Merchant not found");
    return merchant;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _issueTokens(
    merchant: Merchant,
    meta: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthTokens> {
    // Issue access token
    const accessToken = await signAccessToken({
      sub:         merchant.id,
      email:       merchant.email,
      companyName: merchant.companyName,
    });

    // Issue refresh token (stored hashed)
    const rawRefresh = generateRefreshToken();
    await db.insert(refreshTokens).values({
      merchantId: merchant.id,
      tokenHash:  hashRefreshToken(rawRefresh),
      expiresAt:  refreshTokenExpiry(),
      userAgent:  meta.userAgent,
      ipAddress:  meta.ipAddress,
    });

    // Parse ACCESS_EXPIRES to seconds for client convenience
    const expiresMatch = (process.env.JWT_ACCESS_EXPIRES ?? "15m").match(/^(\d+)([smhd])$/);
    const expiresIn = expiresMatch
      ? parseInt(expiresMatch[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[expiresMatch[2]] ?? 60)
      : 900;

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn,
      merchant: {
        id:          merchant.id,
        email:       merchant.email,
        companyName: merchant.companyName,
        fullName:    merchant.fullName,
      },
    };
  }
}

// ─── Error types ──────────────────────────────────────────────────────────────

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(msg: string) { super(msg); this.name = "ConflictError"; }
}
export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(msg: string) { super(msg); this.name = "UnauthorizedError"; }
}
export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(msg: string) { super(msg); this.name = "NotFoundError"; }
}

export const authService = new AuthService();
