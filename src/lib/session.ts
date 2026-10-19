import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { TEAMS } from "./constants";
import type { Team } from "./types";

export const SESSION_COOKIE = "jomsnap_admin";
export const SESSION_DAYS = 14;

type Token = { user: string; exp: number };
/** `team` is set for team logins, who only see and change their own team's things; admins have none */
export type Session = Token & { team?: Team };

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
  const payload = b64(JSON.stringify({ user, exp: Date.now() + SESSION_DAYS * 86400_000 } satisfies Token));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Token;
    if (typeof s.user !== "string" || typeof s.exp !== "number" || s.exp < Date.now()) return null;
    // Looked up on every request: a user removed from the env loses access even with a valid cookie,
    // and moving someone between admin and a team takes effect straight away
    const account = accounts().get(s.user);
    if (!account) return null;
    return { user: s.user, exp: s.exp, team: account.team };
  } catch {
    return null;
  }
}

type Account = { password: string; team?: Team };

/**
 * ADMIN_USERS="syahiran:password1,partner:password2"
 * TEAM_USERS="utara:Utara:password3"  (username:team:password)
 * A name in both lists is an admin.
 */
function accounts() {
  const map = new Map<string, Account>();
  for (const entry of (process.env.TEAM_USERS ?? "").split(",")) {
    const [user, team, ...rest] = entry.split(":");
    const t = TEAMS.find((x) => x.toLowerCase() === team?.trim().toLowerCase());
    if (user?.trim() && t && rest.length) map.set(user.trim().toLowerCase(), { password: rest.join(":"), team: t });
  }
  for (const pair of (process.env.ADMIN_USERS ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) map.set(pair.slice(0, i).trim().toLowerCase(), { password: pair.slice(i + 1) });
  }
  return map;
}

export function checkCredentials(username: string, password: string) {
  const user = username.trim().toLowerCase();
  const expected = accounts().get(user)?.password;
  // Compare against something even for unknown users so timing doesn't reveal valid usernames
  const ok = safeEqual(sign(`pw:${password}`), sign(`pw:${expected ?? "\u0000invalid"}`));
  return ok && expected !== undefined ? user : null;
}
