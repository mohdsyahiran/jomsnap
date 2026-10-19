import type { Booking } from "./types";

const rm = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });
const rm2 = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 });

export const formatRM = (n: number) => rm.format(n).replace("MYR", "RM");
export const formatRM2 = (n: number) => rm2.format(n).replace("MYR", "RM");
export const formatRMShort = (n: number) => (n >= 1000 ? `RM${(n / 1000).toFixed(1)}k` : formatRM(n));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function parseDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const formatDate = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  parseDate(d).toLocaleDateString("en-MY", opts);

export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Package price plus extra charges (e.g. transportation) */
export const totalOf = (b: Booking) => b.price + (b.extras ?? []).reduce((s, e) => s + e.amount, 0);
export const paidOf = (b: Booking) => b.payments.reduce((s, p) => s + p.amount, 0);
export const balanceOf = (b: Booking) => (b.status === "cancelled" ? 0 : Math.max(0, totalOf(b) - paidOf(b)));

export function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Only http(s) links are ever rendered, so a pasted "javascript:" URL can't run */
export function safeUrl(url?: string) {
  if (!url) return undefined;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function whatsappLink(phone?: string) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("0") ? "6" + digits : digits}`;
}
