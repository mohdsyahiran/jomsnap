import { categoryOf, PAY_METHODS } from "./constants";
import { download } from "./download";
import type { AdminData, PayMethod } from "./types";

export type LedgerEntry = {
  key: string;
  date: string;
  type: "in" | "out";
  amount: number;
  category: string;
  label: string;
  method: PayMethod;
  by?: string;
  /** Booking payments are edited from the booking; manual entries can be deleted here */
  source: { kind: "payment"; bookingId: string } | { kind: "txn"; id: string };
};

/** Every ringgit in or out: booking payments plus manual money entries, newest first. */
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
  return [...fromPayments, ...fromTxns].sort((a, b) => b.date.localeCompare(a.date));
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
      PAY_METHODS[e.method],
      (e.type === "in" ? e.amount : -e.amount).toFixed(2),
      e.by ?? "",
    ]),
  ];
  download("﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n"), filename, "text/csv;charset=utf-8");
}
