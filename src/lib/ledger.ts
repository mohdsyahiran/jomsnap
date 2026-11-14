import { categoryOf, COST_ITEMS, PAY_METHODS } from "./constants";
import { download } from "./download";
import { toISODate } from "./format";
import { instalmentsOf } from "./instalments";
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
  source: { kind: "payment"; bookingId: string } | { kind: "cost"; bookingId: string } | { kind: "instalment"; investmentId: string } | { kind: "txn"; id: string };
};

/** Instalments come from the ROI investment list, so they never need entering by hand */
export const INSTALMENT_CATEGORY = "instalment";

// Booking cost types → money out categories
const COST_CATEGORY: Record<CostKey, string> = { crew: "crew", designer: "designer", transport: "transport", guestbook: "guestbook", other: "other-out" };

/**
 * Every ringgit in or out, newest first: booking payments, booking costs (on the event date),
 * instalments due so far on investments, and manual money entries.
 */
export function buildLedger(data: AdminData, today = toISODate(new Date())): LedgerEntry[] {
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
  const fromInstalments: LedgerEntry[] = data.investments.flatMap((inv) => {
    const plan = instalmentsOf(inv, today);
    if (!plan) return [];
    const base = { type: "out" as const, category: INSTALMENT_CATEGORY, source: { kind: "instalment" as const, investmentId: inv.id } };
    const due = plan.dueDates.slice(0, plan.paid).map((date, n) => ({
      ...base,
      key: `i-${inv.id}-${n}`,
      date,
      amount: plan.monthly,
      label: `${inv.item} · instalment ${n + 1} of ${plan.months}`,
    }));
    return plan.settled ? [{ ...base, key: `i-${inv.id}-settled`, date: inv.date, amount: plan.settled, label: `${inv.item} · paid off early` }, ...due] : due;
  });
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
  return [...fromPayments, ...fromCosts, ...fromInstalments, ...fromTxns].sort((a, b) => b.date.localeCompare(a.date));
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
      e.method ? PAY_METHODS[e.method] : e.source.kind === "instalment" ? "Instalment" : "Booking cost",
      (e.type === "in" ? e.amount : -e.amount).toFixed(2),
      e.by ?? "",
    ]),
  ];
  download("﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n"), filename, "text/csv;charset=utf-8");
}
