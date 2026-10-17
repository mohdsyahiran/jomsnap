import { uid } from "./format";
import type { AdminData, StockItem } from "./types";

// Consumables tracked by default; counts start at 0 until the first restock
export const DEFAULT_STOCK: StockItem[] = [
  { id: "media-4x6", name: "DNP 4x6 Media Roll", unit: "rolls", qty: 0, threshold: 6, capacity: 30 },
  { id: "ribbon", name: "Dye-Sub Ink Ribbon", unit: "ribbons", qty: 0, threshold: 5, capacity: 30 },
  { id: "guestbook", name: "Guestbook", unit: "books", qty: 0, threshold: 5, capacity: 25 },
  { id: "props", name: "Prop Kit", unit: "kits", qty: 0, threshold: 1, capacity: 4 },
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
