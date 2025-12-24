import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIX = "scrypt";
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN);
  return `${PREFIX}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function verifyPassword(stored: string, password: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [prefix, saltB64, keyB64] = parts;
  if (prefix !== PREFIX) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expectedKey = Buffer.from(keyB64, "base64");
  const actualKey = scryptSync(password, salt, expectedKey.length);

  if (actualKey.length !== expectedKey.length) return false;
  return timingSafeEqual(actualKey, expectedKey);
}
