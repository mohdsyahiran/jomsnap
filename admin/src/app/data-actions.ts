"use server";

import { cookies } from "next/headers";
import { loadSnapshot, saveSnapshot, type Snapshot } from "@/lib/db";
import { isAdminData, normalize, reducer, type Action } from "@/lib/reducer";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

async function requireUser() {
  const session = verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw new Error("Not signed in");
  return session.user;
}

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
]);

const isMoney = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 10_000_000;

function validate(a: Action): string | null {
  if (!a || !ACTION_TYPES.has(a.type)) return "Unknown action";
  if (a.type === "load" && !isAdminData(a.data)) return "Not a JomSnap admin backup";
  if (a.type === "saveBooking" && (!a.booking?.client || !isMoney(a.booking.price))) return "Invalid booking";
  if (a.type === "addPayment" && !(isMoney(a.payment?.amount) && a.payment.amount > 0)) return "Invalid amount";
  if (a.type === "addTxn" && !(isMoney(a.txn?.amount) && a.txn.amount > 0 && (a.txn.type === "in" || a.txn.type === "out"))) return "Invalid amount";
  if (a.type === "adjustStock" && !(Number.isInteger(a.delta) && Math.abs(a.delta) < 10_000 && (a.cost === undefined || isMoney(a.cost)))) return "Invalid quantity";
  return null;
}

export async function fetchSnapshot(): Promise<Snapshot> {
  await requireUser();
  return loadSnapshot();
}

export type ApplyResult = { ok: true; snapshot: Snapshot } | { ok: false; error: string };

/** Applies one change against the latest saved data, retrying if another user saved at the same moment. */
export async function applyAction(action: Action): Promise<ApplyResult> {
  const user = await requireUser();
  const invalid = validate(action);
  if (invalid) return { ok: false, error: invalid };
  const stamped = action.type === "load" ? { ...action, data: normalize(action.data), by: user } : { ...action, by: user };

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await loadSnapshot();
    const next = reducer(current.data, stamped);
    if (next === current.data) return { ok: true, snapshot: current };
    const saved = await saveSnapshot(next, current.version, user);
    if (saved) return { ok: true, snapshot: saved };
  }
  return { ok: false, error: "Too many people saving at once. Please try again." };
}
