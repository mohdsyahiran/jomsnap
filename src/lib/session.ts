import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "jomsnap_admin";
export const SESSION_DAYS = 14;

export type Session = { user: string; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return s;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Token format: base64url(JSON payload) + "." + HMAC-SHA256 signature */
export function createToken(user: string) {
  const payload = b64(JSON.stringify({ user, exp: Date.now() + SESSION_DAYS * 86400_000 } satisfies Session));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (typeof s.user !== "string" || typeof s.exp !== "number" || s.exp < Date.now()) return null;
    // A user removed from ADMIN_USERS loses access even with a valid cookie
    if (!adminUsers().has(s.user)) return null;
    return s;
  } catch {
    return null;
  }
}

/** ADMIN_USERS="syahiran:password1,partner:password2" */
function adminUsers() {
  const map = new Map<string, string>();
  for (const pair of (process.env.ADMIN_USERS ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) map.set(pair.slice(0, i).trim().toLowerCase(), pair.slice(i + 1));
  }
  return map;
}

export function checkCredentials(username: string, password: string) {
  const user = username.trim().toLowerCase();
  const expected = adminUsers().get(user);
  // Compare against something even for unknown users so timing doesn't reveal valid usernames
  const ok = safeEqual(sign(`pw:${password}`), sign(`pw:${expected ?? "\u0000invalid"}`));
  return ok && expected !== undefined ? user : null;
}
