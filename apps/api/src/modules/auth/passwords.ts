import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";

const legacySha256Prefix = "legacy-sha256:";

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export function legacyPasswordHash(sha256Hash: string) {
  return `${legacySha256Prefix}${sha256Hash}`;
}

export function temporaryPasswordHashSource() {
  return randomBytes(32).toString("base64url");
}

export function isLegacyPasswordHash(passwordHash: string) {
  return passwordHash.startsWith(legacySha256Prefix);
}

export async function verifyPassword(passwordHash: string, password: string) {
  if (isLegacyPasswordHash(passwordHash)) {
    const expected = passwordHash.slice(legacySha256Prefix.length).toLowerCase();
    const actual = createHash("sha256").update(password).digest("hex").toLowerCase();
    return actual === expected;
  }
  return argon2.verify(passwordHash, password);
}
