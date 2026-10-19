"use server";

import { cookies } from "next/headers";
import { loadSnapshot, saveSnapshot, type Snapshot } from "@/lib/db";
import { STATUSES, TEAMS } from "@/lib/constants";
import { safeUrl } from "@/lib/format";
import { isAdminData, normalize, reducer, type Action } from "@/lib/reducer";
import { scopeSnapshot } from "@/lib/scope";
import { SESSION_COOKIE, verifyToken, type Session } from "@/lib/session";
import type { AdminData } from "@/lib/types";

/**
 * `as` is the account the open page was loaded for. If the browser has since signed in as someone else
 * (e.g. in another tab), the page must reload rather than show or change data under the wrong account.
 */
async function requireUser(as: string) {
  const session = verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || session.user !== as) return null;
  return session;
}

/** Team logins may only change their own team's stock, guestbooks and unavailability. Checked against the latest data. */
function forbidden(a: Action, session: Session, data: AdminData): string | null {
  const team = session.team;
  // Days off are each team's own to mark; admin sees them but doesn't change them
  if (!team) return a.type === "addUnavailable" || a.type === "deleteUnavailable" ? "Only the team can change its unavailable days." : null;
  if (a.type === "adjustStock" && data.stock.find((s) => s.id === a.id)?.team === team) return null;
  if ((a.type === "setGuestbook" || a.type === "setPrep") && data.bookings.find((b) => b.id === a.id)?.team === team) return null;
  if (a.type === "addUnavailable" && a.entry.team === team) return null;
  if (a.type === "deleteUnavailable" && data.unavailability.find((u) => u.id === a.id)?.team === team) return null;
  return "Your login can only update your team's stock, guestbooks, event prep and unavailability.";
}

const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const ACTION_TYPES = new Set<Action["type"]>([
  "load",
  "saveBooking",
  "deleteBooking",
  "setStatus",
  "addPayment",
  "deletePayment",
  "recordSupplies",
  "adjustStock",
  "addTxn",
  "deleteTxn",
  "setGuestbook",
  "issueInvoice",
  "addUnavailable",
  "deleteUnavailable",
  "setPrep",
]);

const isMoney = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 10_000_000;

function validate(a: Action): string | null {
  if (!a || !ACTION_TYPES.has(a.type)) return "Unknown action";
  if (a.type === "load" && !isAdminData(a.data)) return "Not a JomSnap admin backup";
  if (a.type === "saveBooking" && (!a.booking?.client || !isMoney(a.booking.price) || typeof a.guestbookNeeded !== "boolean")) return "Invalid booking";
  if (a.type === "saveBooking" && !(STATUSES as readonly string[]).includes(a.booking.status)) return "Choose a status: Confirmed, Completed or Cancelled";
  if (a.type === "saveBooking" && !(TEAMS as readonly string[]).includes(a.booking.team ?? "")) return "Choose a team";
  if (a.type === "saveBooking" && a.booking.designUrl && !safeUrl(a.booking.designUrl)) return "Design link must start with https://";
  if (
    a.type === "saveBooking" &&
    a.booking.extras !== undefined &&
    !(Array.isArray(a.booking.extras) && a.booking.extras.length <= 10 && a.booking.extras.every((e) => typeof e?.label === "string" && e.label.trim() && isMoney(e.amount)))
  )
    return "Invalid extra charges";
  if (a.type === "issueInvoice" && !/^[A-Za-z0-9/-]{1,30}$/.test(a.invoiceNo?.trim() ?? "")) return "Invoice number can only use letters, numbers, - and /";
  if (a.type === "setGuestbook" && (!["pending", "ordered", "received"].includes(a.status) || (a.cost !== undefined && !isMoney(a.cost)))) return "Invalid guestbook update";
  if (a.type === "setPrep" && !(["guestbook", "design", "backdrop"].includes(a.item) && typeof a.done === "boolean")) return "Invalid reminder update";
  if (a.type === "addPayment" && !(isMoney(a.payment?.amount) && a.payment.amount > 0)) return "Invalid amount";
  if (a.type === "addTxn" && !(isMoney(a.txn?.amount) && a.txn.amount > 0 && (a.txn.type === "in" || a.txn.type === "out"))) return "Invalid amount";
  if (
    a.type === "addUnavailable" &&
    !(
      (TEAMS as readonly string[]).includes(a.entry?.team) &&
      isDay(a.entry.from) &&
      isDay(a.entry.to) &&
      a.entry.from <= a.entry.to &&
      (a.entry.note === undefined || (typeof a.entry.note === "string" && a.entry.note.length <= 200))
    )
  )
    return "Pick a valid date range (the end can't be before the start)";
  if (a.type === "adjustStock" && !(Number.isInteger(a.delta) && Math.abs(a.delta) < 10_000 && (a.cost === undefined || isMoney(a.cost)))) return "Invalid quantity";
  return null;
}

/** `null` means the page's account is no longer the signed-in one: reload */
export async function fetchSnapshot(as: string): Promise<Snapshot | null> {
  const session = await requireUser(as);
  if (!session) return null;
  return scopeSnapshot(await loadSnapshot(), session.team);
}

export type ApplyResult = { ok: true; snapshot: Snapshot } | { ok: false; error: string; signedOut?: boolean };

/** Applies one change against the latest saved data, retrying if another user saved at the same moment. */
export async function applyAction(action: Action, as: string): Promise<ApplyResult> {
  const session = await requireUser(as);
  if (!session) return { ok: false, error: "You were signed out or switched account.", signedOut: true };
  const { user, team } = session;
  const invalid = validate(action);
  if (invalid) return { ok: false, error: invalid };
  const stamped = action.type === "load" ? { ...action, data: normalize(action.data), by: user } : { ...action, by: user };

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadSnapshot();
    const denied = forbidden(action, session, current.data);
    if (denied) return { ok: false, error: denied };
    const next = reducer(current.data, stamped);
    if (next === current.data) return { ok: true, snapshot: scopeSnapshot(current, team) };
    const saved = await saveSnapshot(next, current.version, user);
    if (saved) return { ok: true, snapshot: scopeSnapshot(saved, team) };
  }
  return { ok: false, error: "Too many people saving at once. Please try again." };
}
