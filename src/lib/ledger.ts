import { categoryOf, COST_ITEMS, PAY_METHODS } from "./constants";
import { download } from "./download";
import type { AdminData, CostKey, PayMethod } from "./types";

export type LedgerEntry = {
  key: string;
  date: string;
  type: "in" | "out";
  amount: number;
  category: string;
  label: string;
  /** Booking costs don't record how they were paid */
  method?: PayMethod;
  by?: string;
  /** Booking payments and costs are edited from the booking; manual entries can be deleted here */
  source: { kind: "payment"; bookingId: string } | { kind: "cost"; bookingId: string } | { kind: "txn"; id: string };
};

// Booking cost types → money out categories
const COST_CATEGORY: Record<CostKey, string> = { crew: "crew", designer: "designer", transport: "transport", guestbook: "guestbook", other: "other-out" };

/** Every ringgit in or out: booking payments, booking costs (on the event date) and manual money entries, newest first. */
export function buildLedger(data: AdminData): LedgerEntry[] {
  const fromPayments: LedgerEntry[] = data.bookings.flatMap((b) =>
    b.payments.map((p) => ({
      key: `p-${p.id}`,
      date: p.date,
      type: "in" as const,
      amount: p.amount,
      category: "booking",
      label: `#${b.code} ${b.client}${p.note ? ` · ${p.note}` : ""}`,
      method: p.method,
      by: p.by,
      source: { kind: "payment" as const, bookingId: b.id },
    })),
  );
  const fromCosts: LedgerEntry[] = data.bookings
    .filter((b) => b.status !== "cancelled")
    .flatMap((b) =>
      (b.costs ?? []).map((c, i) => ({
        key: `c-${b.id}-${i}`,
        date: b.date,
        type: "out" as const,
        amount: c.amount,
        category: COST_CATEGORY[c.type] ?? "other-out",
        label: `#${b.code} ${b.client} · ${(c.type === "other" && c.note) || COST_ITEMS.find((x) => x.id === c.type)?.label || c.type}`,
        source: { kind: "cost" as const, bookingId: b.id },
      })),
    );
  const fromTxns: LedgerEntry[] = data.transactions.map((t) => ({
    key: `t-${t.id}`,
    date: t.date,
    type: t.type,
    amount: t.amount,
    category: t.category,
    label: t.note || categoryOf(t.category).label,
    method: t.method,
    by: t.by,
    source: { kind: "txn" as const, id: t.id },
  }));
  return [...fromPayments, ...fromCosts, ...fromTxns].sort((a, b) => b.date.localeCompare(a.date));
}

export function exportLedgerCSV(entries: LedgerEntry[], filename: string) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    ["Date", "Type", "Category", "Description", "Method", "Amount (RM)", "Recorded by"],
    ...entries.map((e) => [
      e.date,
      e.type === "in" ? "Money in" : "Money out",
      categoryOf(e.category).label,
      e.label,
      e.method ? PAY_METHODS[e.method] : "Booking cost",
      (e.type === "in" ? e.amount : -e.amount).toFixed(2),
      e.by ?? "",
    ]),
  ];
  download("﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n"), filename, "text/csv;charset=utf-8");
}
