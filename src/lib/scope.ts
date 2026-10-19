import "server-only";
import type { Snapshot } from "./db";
import type { AdminData, Booking, Team } from "./types";

/** Event details a crew needs, without prices, payments or invoices */
const forCrew = (b: Booking): Booking => ({ ...b, price: 0, payments: [], extras: undefined, invoiceNo: undefined, invoiceDate: undefined });

/** The part of the data a team login may see. Everything sent to a team browser goes through this. */
export function scopeData(data: AdminData, team: Team | undefined): AdminData {
  if (!team) return data;
  return {
    ...data,
    bookings: data.bookings.filter((b) => b.team === team).map(forCrew),
    stock: data.stock.filter((s) => s.team === team),
    unavailability: data.unavailability.filter((u) => u.team === team),
    audit: data.audit.filter((a) => a.team === team),
    transactions: [],
  };
}

export const scopeSnapshot = (s: Snapshot, team: Team | undefined): Snapshot => (team ? { ...s, data: scopeData(s.data, team) } : s);
