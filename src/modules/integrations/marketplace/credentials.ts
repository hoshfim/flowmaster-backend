/**
 * AES-256-GCM credential encryption.
 *
 * Credentials are encrypted before being written to the DB and decrypted
 * only at runtime when a sync job needs them. They are NEVER sent to the client.
 *
 * Requires ENCRYPTION_KEY in .env — a hex string of at least 64 characters (32 bytes).
 * If you used randomBytes(64).toString('hex') (128 chars) that is fine — the first
 * 32 bytes are used. AES-256 always needs exactly 32 bytes.
 *
 * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES  = 12;  // 96-bit IV recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag

/**
 * Derive the 32-byte AES key from the hex ENCRYPTION_KEY env var.
 * Accepts any hex string >= 64 chars — slices to the first 32 bytes.
 */
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error(
      "ENCRYPTION_KEY must be at least 64 hex characters (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY must only contain hex characters (0-9, a-f, A-F)");
  }
  // Take exactly the first 64 hex chars = 32 bytes for AES-256
  return Buffer.from(hex.slice(0, 64), "hex");
}

/**
 * Encrypt a credentials object.
 * Returns a base64 string: iv(12 bytes) + ciphertext + authTag(16 bytes)
 */
export function encryptCredentials(credentials: Record<string, string>): string {
  const key    = getKey();
  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

/**
 * Decrypt credentials back to a plain object.
 */
export function decryptCredentials(encryptedBase64: string): Record<string, string> {
  const key = getKey();
  const buf = Buffer.from(encryptedBase64, "base64");

  const iv         = buf.subarray(0, IV_BYTES);
  const authTag    = buf.subarray(buf.length - TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, string>;
}

/**
 * Mask a credential value for safe display in logs / API responses.
 */
export function maskCredential(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
