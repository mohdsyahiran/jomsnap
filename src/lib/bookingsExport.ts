import { GUESTBOOK_STYLE, PACKAGES, PAY_METHODS, STATUS_STYLE } from "./constants";
import { download } from "./download";
import { balanceOf, paidOf, totalOf } from "./format";
import type { Booking } from "./types";

/** Text a spreadsheet would otherwise read as a formula (e.g. a name starting with "=") gets a leading apostrophe */
const text = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

function paymentStatus(b: Booking) {
  if (b.status === "cancelled") return "";
  if (balanceOf(b) === 0) return "Pay Full";
  return paidOf(b) > 0 ? "Pay Depo" : "Not yet";
}

/** CSV with a BOM, so Excel opens it directly with the RM amounts and Malay names intact. */
export function exportBookingsCSV(bookings: Booking[], filename: string) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rm = (n: number) => n.toFixed(2);
  const rows = [
    [
      "Booking #",
      "Event date",
      "Start",
      "End",
      "Client",
      "Phone",
      "Event type",
      "Venue",
      "Area",
      "Team",
      "Package",
      "Package price (RM)",
      "Extras",
      "Total (RM)",
      "Paid (RM)",
      "Balance (RM)",
      "Payment",
      "Payments",
      "Status",
      "Guestbook",
      "Backdrop",
      "Invoice no",
      "Notes",
    ],
    ...bookings.map((b) => [
      String(b.code),
      b.date,
      b.startTime,
      b.endTime,
      text(b.client),
      // ="…" keeps the leading 0 and stops Excel turning long numbers into 6.01E+10
      b.phone ? `="${b.phone.replace(/"/g, "")}"` : "",
      b.eventType,
      text(b.venue),
      b.area,
      b.team ?? "",
      PACKAGES[b.packageId]?.label ?? b.packageId,
      rm(b.price),
      text((b.extras ?? []).map((e) => `${e.label} RM${rm(e.amount)}`).join("; ")),
      rm(totalOf(b)),
      rm(paidOf(b)),
      rm(balanceOf(b)),
      paymentStatus(b),
      text(b.payments.map((p) => `${p.date} RM${rm(p.amount)} ${PAY_METHODS[p.method]}${p.note ? ` (${p.note})` : ""}`).join("; ")),
      STATUS_STYLE[b.status].label,
      b.guestbook ? GUESTBOOK_STYLE[b.guestbook.status].label.replace("Guestbook: ", "") : "",
      text(b.backdrop ?? ""),
      b.invoiceNo ?? "",
      text(b.notes ?? ""),
    ]),
  ];
  download("﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n"), filename, "text/csv;charset=utf-8");
}
