import { REMINDER_DAYS } from "./constants";
import { parseDate } from "./format";
import type { AdminData, Booking, PrepItem } from "./types";

export type PrepCheck = { item: PrepItem; label: string; done: boolean };
export type PrepReminder = { booking: Booking; daysLeft: number; checks: PrepCheck[]; open: number };

const daysUntil = (today: string, date: string) => Math.round((parseDate(date).getTime() - parseDate(today).getTime()) / 86400_000);

/** The prep checklist for one booking. The guestbook only counts when the booking has one. */
export function prepChecks(b: Booking): PrepCheck[] {
  return [
    ...(b.guestbook ? [{ item: "guestbook" as const, label: "Guestbook printed", done: b.guestbook.status === "received" }] : []),
    { item: "design", label: "Photostrip design finalized", done: !!b.prep?.design },
    { item: "backdrop", label: "Backdrop ready", done: !!b.prep?.backdrop },
  ];
}

/** Upcoming events within REMINDER_DAYS, soonest first */
export function prepReminders(data: AdminData, today: string): PrepReminder[] {
  return data.bookings
    .filter((b) => b.status !== "cancelled" && b.status !== "completed" && b.date >= today && daysUntil(today, b.date) <= REMINDER_DAYS)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .map((booking) => {
      const checks = prepChecks(booking);
      return { booking, daysLeft: daysUntil(today, booking.date), checks, open: checks.filter((c) => !c.done).length };
    });
}
