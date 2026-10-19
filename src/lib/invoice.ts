import { PACKAGES } from "./constants";
import { balanceOf, paidOf, totalOf } from "./format";
import type { AdminData, Booking } from "./types";

// Issuer details printed on every invoice
export const BUSINESS = {
  name: "Niskara Worldwide",
  regNo: "KT0620473-X",
  phones: ["+60 11 6118 7310", "+60 16 272 6915"],
  email: "jomsnapbooth@gmail.com",
  bank: { name: "GX Bank", accountName: "Niskara Worldwide", accountNo: "8188-060836-9" },
};

export type InvoiceLine = { description: string; price: number | "included"; qty: number; total: number };

export function invoiceLines(b: Booking): InvoiceLine[] {
  const pkg = b.packageId === "custom" ? "Photobooth package" : `Photobooth ${PACKAGES[b.packageId].label.split(" ·")[0]} package`;
  return [
    { description: pkg, price: b.price, qty: 1, total: b.price },
    ...(b.extras ?? []).map((e) => ({ description: e.label, price: e.amount, qty: 1, total: e.amount })),
    ...(b.guestbook ? [{ description: "Guestbook", price: "included" as const, qty: 1, total: 0 }] : []),
    // Every package includes digital copies of all photos
    { description: "Digital Photos", price: "included", qty: 1, total: 0 },
  ];
}

export function paymentStatus(b: Booking) {
  const paid = paidOf(b);
  if (paid > 0 && balanceOf(b) === 0) return "PAID";
  if (paid > 0) return "DEPOSIT PAID";
  return "UNPAID";
}

/** Suggests the next number in the JS-YYYY-NNN series for the given year. */
export function nextInvoiceNo(data: AdminData, year: number) {
  const prefix = `JS-${year}-`;
  const used = data.bookings.map((b) => b.invoiceNo).filter((n): n is string => !!n?.startsWith(prefix));
  const max = Math.max(0, ...used.map((n) => Number(n.slice(prefix.length)) || 0));
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** An invoice can be issued once the client has paid something or the date is confirmed. */
export const canInvoice = (b: Booking) => b.status !== "cancelled" && (paidOf(b) > 0 || b.status === "confirmed" || b.status === "completed");

export { totalOf };
