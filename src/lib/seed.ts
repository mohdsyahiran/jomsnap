import { DEFAULT_COST_PER_EVENT, TEAMS } from "./constants";
import { uid } from "./format";
import type { AdminData, ChecklistItem, StockItem, Team } from "./types";

// Stock each team tracks. Guestbooks are not stocked: they are ordered per booking.
export const DEFAULT_STOCK: Omit<StockItem, "team">[] = [
  { id: "media-4x6", name: "DNP 4x6 Media Roll", unit: "rolls", kind: "count", qty: 0, min: 2 },
  { id: "props", name: "Props", unit: "", kind: "available", qty: 0, min: 1 },
];

// What goes to every event, from the investment list
const DEFAULT_CHECKLIST = [
  "Kotak photobooth",
  "Camera + battery",
  "Camera charger",
  "Laptop + charger",
  "DNP printer",
  "Media roll (paper & ink)",
  "Lampu",
  "Backdrop stand (steel)",
  "Backdrop / langsir",
  "Banting",
  "Props + rak prop",
  "Meja + banquet cloth",
  "Carpet",
  "Welcome frame",
  "Frames",
  "Extension wire",
  "USB hub",
  "Tali / cable ties",
  "Iron",
  "Wagon",
  "Guestbook",
  "Business cards + holder",
];

export const defaultChecklist = (): ChecklistItem[] =>
  TEAMS.flatMap((team) => DEFAULT_CHECKLIST.map((label, i) => ({ id: `${team.toLowerCase()}-${i}`, team, label, done: false })));

/** HQ keeps the original ids so existing saves carry over; other teams get a suffix */
export const stockId = (team: Team, baseId: string) => (team === "HQ" ? baseId : `${baseId}-${team.toLowerCase()}`);

export function emptyData(): AdminData {
  return {
    schemaVersion: 1,
    bookings: [],
    transactions: [],
    stock: TEAMS.flatMap((team) => DEFAULT_STOCK.map((s) => ({ ...s, id: stockId(team, s.id), team }))),
    unavailability: [],
    investments: [],
    checklist: defaultChecklist(),
    costPerEvent: DEFAULT_COST_PER_EVENT,
    audit: [{ id: uid(), at: new Date().toISOString(), kind: "system", message: "Started with empty data" }],
    nextCode: 1001,
  };
}
