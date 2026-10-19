import { GUESTBOOK_LEAD_DAYS, GUESTBOOK_WARN_DAYS } from "./constants";
import { formatDate, parseDate, toISODate } from "./format";
import type { AdminData, Booking, StockItem, Team } from "./types";

export const isLow = (s: StockItem) => s.qty < s.min;

export function stockLabel(s: StockItem) {
  if (s.kind === "available") return s.qty > 0 ? "Available" : "Not available";
  return `${s.qty} ${s.unit}`;
}

export function orderByDate(b: Booking) {
  const d = parseDate(b.date);
  d.setDate(d.getDate() - GUESTBOOK_LEAD_DAYS);
  return toISODate(d);
}

const daysBetween = (from: string, to: string) => Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400_000);

export type GuestbookTask = {
  booking: Booking;
  orderBy: string;
  /** late: past order-by and not ordered; due: order-by within the warning window; waiting: ordered, not received, event close; ok */
  urgency: "late" | "due" | "waiting" | "ok";
  message: string;
};

/** Guestbook orders for upcoming bookings, most urgent first. */
export function guestbookTasks(data: AdminData, today: string): GuestbookTask[] {
  const rank = { late: 0, due: 1, waiting: 2, ok: 3 };
  return data.bookings
    .filter((b) => b.guestbook && b.status !== "cancelled" && b.status !== "completed" && b.date >= today)
    .map((b): GuestbookTask => {
      const orderBy = orderByDate(b);
      const g = b.guestbook!;
      const untilOrder = daysBetween(today, orderBy);
      const untilEvent = daysBetween(today, b.date);
      if (g.status === "pending") {
        if (untilOrder < 0) return { booking: b, orderBy, urgency: "late", message: `Order now: was due ${formatDate(orderBy, { day: "numeric", month: "short" })}` };
        if (untilOrder <= GUESTBOOK_WARN_DAYS)
          return { booking: b, orderBy, urgency: "due", message: untilOrder === 0 ? "Order today" : `Order within ${untilOrder} day${untilOrder > 1 ? "s" : ""}` };
        return { booking: b, orderBy, urgency: "ok", message: `Order by ${formatDate(orderBy, { day: "numeric", month: "short" })}` };
      }
      if (g.status === "ordered" && untilEvent <= 2) return { booking: b, orderBy, urgency: "waiting", message: "Ordered but not received yet" };
      return { booking: b, orderBy, urgency: "ok", message: g.status === "ordered" ? "Ordered, waiting for delivery" : "Received" };
    })
    .sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.booking.date.localeCompare(b.booking.date));
}

/** Everything that needs attention, as short lines for the Overview card and badges. */
/** Admin (no `team`) gets HQ stock; a team login its own. Guestbooks cover whatever bookings the login can see. */
export function stockAlerts(data: AdminData, today = toISODate(new Date()), team?: Team) {
  const low = data.stock.filter((s) => s.team === (team ?? "HQ") && isLow(s));
  const guestbooks = guestbookTasks(data, today).filter((t) => t.urgency !== "ok");
  const lines = [
    ...low.map((s) => (s.kind === "available" ? `${s.name}: not available` : `${s.name}: ${s.qty} left (need ${s.min})`)),
    ...guestbooks.map((t) => `Guestbook #${t.booking.code} ${t.booking.client}: ${t.message.toLowerCase()}`),
  ];
  return { low, guestbooks, lines, count: lines.length };
}
