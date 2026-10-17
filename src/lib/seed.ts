import { uid } from "./format";
import type { AdminData, StockItem } from "./types";

// Stock tracked by default. Guestbooks are not stocked: they are ordered per booking.
export const DEFAULT_STOCK: StockItem[] = [
  { id: "media-4x6", name: "DNP 4x6 Media Roll", unit: "rolls", kind: "count", qty: 0, min: 2 },
  { id: "props", name: "Props", unit: "", kind: "available", qty: 0, min: 1 },
];

export function emptyData(): AdminData {
  return {
    schemaVersion: 1,
    bookings: [],
    transactions: [],
    stock: DEFAULT_STOCK.map((s) => ({ ...s })),
    audit: [{ id: uid(), at: new Date().toISOString(), kind: "system", message: "Started with empty data" }],
    nextCode: 1001,
  };
}
