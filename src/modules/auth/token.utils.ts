import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { env } from "../../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  companyName: string;
  iat?: number;
  exp?: number;
}

function accessSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}
function refreshSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_REFRESH_SECRET);
}

function parseDurationSeconds(d: string): number {
  const m = d.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`Invalid duration: ${d}`);
  const n = parseInt(m[1], 10);
  return n * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2]] ?? 1);
}

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + parseDurationSeconds(env.JWT_ACCESS_EXPIRES);
  return new SignJWT({ email: payload.email, companyName: payload.companyName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .setIssuer("flowmaster-ai")
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret(), {
    issuer: "flowmaster-ai",
    algorithms: ["HS256"],
  });
  if (!payload.sub) throw new Error("Token missing sub");
  return {
    sub:         payload.sub,
    email:       payload["email"] as string,
    companyName: payload["companyName"] as string,
    iat:         payload.iat,
    exp:         payload.exp,
  };
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + parseDurationSeconds(env.JWT_REFRESH_EXPIRES) * 1000);
}
