import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function resolveKeyMaterial(): Buffer | null {
  const raw = process.env.YOUTUBE_TOKEN_CIPHER_KEY;
  if (!raw) return null;

  if (raw.startsWith("base64:")) {
    const decoded = Buffer.from(raw.slice("base64:".length), "base64");
    if (decoded.length === 32) return decoded;
  }

  if (raw.startsWith("hex:")) {
    const decoded = Buffer.from(raw.slice("hex:".length), "hex");
    if (decoded.length === 32) return decoded;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;

  // Passphrase mode fallback: derive a stable 256-bit key.
  return createHash("sha256").update(raw).digest();
}

export function isYoutubeTokenEncryptionConfigured(): boolean {
  return resolveKeyMaterial() !== null;
}

export function decryptYoutubeToken(encrypted: string): string {
  const key = resolveKeyMaterial();
  if (!key) {
    throw new Error("YOUTUBE_TOKEN_CIPHER_KEY is not configured");
  }

  const parts = encrypted.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const ciphertext = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptYoutubeToken(plainText: string): string {
  const key = resolveKeyMaterial();
  if (!key) {
    throw new Error("YOUTUBE_TOKEN_CIPHER_KEY is not configured");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}
