"use client";

import { useState } from "react";
import { categoryOf, PAY_METHODS } from "@/lib/constants";
import { formatDate, formatRM, formatRM2 } from "@/lib/format";
import { buildLedger, exportLedgerCSV, type LedgerEntry } from "@/lib/ledger";
import { useStore } from "@/lib/store";
import { Button, Card, Empty, Icon, PanelHeader } from "../ui";

type Period = { kind: "month" | "year"; year: number; month: number };

const inPeriod = (date: string, p: Period) => {
  const [y, m] = date.split("-").map(Number);
  return y === p.year && (p.kind === "year" || m - 1 === p.month);
};
const sumOf = (xs: LedgerEntry[], type: "in" | "out") => xs.reduce((s, e) => s + (e.type === type ? e.amount : 0), 0);

export function Money({ onAdd, onOpenPayment }: { onAdd: (t: "in" | "out") => void; onOpenPayment: (bookingId: string) => void }) {
  const { data, dispatch } = useStore();
  const [period, setPeriod] = useState<Period>(() => {
    const n = new Date();
    return { kind: "month", year: n.getFullYear(), month: n.getMonth() };
  });
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const ledger = buildLedger(data);
  const inP = ledger.filter((e) => inPeriod(e.date, period));
  const moneyIn = sumOf(inP, "in");
  const moneyOut = sumOf(inP, "out");
  const net = moneyIn - moneyOut;
  const cash = sumOf(ledger, "in") - sumOf(ledger, "out");
  const rows = inP.filter((e) => filter === "all" || e.type === filter);

  const label =
    period.kind === "month" ? new Date(period.year, period.month, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" }) : String(period.year);
  const shift = (n: number) =>
    setPeriod((p) => {
      if (p.kind === "year") return { ...p, year: p.year + n };
      const d = new Date(p.year, p.month + n, 1);
      return { ...p, year: d.getFullYear(), month: d.getMonth() };
    });

  const remove = (e: LedgerEntry) => {
    if (e.source.kind === "payment") return onOpenPayment(e.source.bookingId);
    if (confirm(`Delete "${e.label}" (${formatRM2(e.amount)})?`)) dispatch({ type: "deleteTxn", id: e.source.id });
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="account_balance"
        iconClass="bg-tertiary-fixed text-on-tertiary-fixed"
        title="Money In & Out"
        subtitle="Booking payments are counted automatically. Add expenses like supplies, fuel and crew pay here."
      >
        <Button icon="download" onClick={() => exportLedgerCSV(inP, `jomsnap-money-${label.replace(/\s+/g, "-").toLowerCase()}.csv`)} disabled={!inP.length}>
          Export CSV
        </Button>
        <Button icon="south_west" className="bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-on-tertiary-fixed" onClick={() => onAdd("in")}>
          Money in
        </Button>
        <Button variant="primary" icon="north_east" onClick={() => onAdd("out")}>
          Money out
        </Button>
      </PanelHeader>

      {/* Period picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="px-2" onClick={() => shift(-1)} aria-label="Previous">
            <Icon name="chevron_left" />
          </Button>
          <span className="min-w-36 text-center text-headline-sm font-bold text-primary">{label}</span>
          <Button variant="ghost" className="px-2" onClick={() => shift(1)} aria-label="Next">
            <Icon name="chevron_right" />
          </Button>
        </div>
        <div className="flex items-center gap-1 p-1 bg-surface-container-high rounded-lg">
          {(["month", "year"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPeriod((p) => ({ ...p, kind: k }))}
              className={`px-3 py-1.5 rounded-lg text-label-md font-semibold ${period.kind === k ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
            >
              {k === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <Stat label="Money in" icon="south_west" value={formatRM(moneyIn)} tone="text-tertiary" iconClass="bg-tertiary-fixed text-tertiary" />
        <Stat label="Money out" icon="north_east" value={formatRM(moneyOut)} tone="text-error" iconClass="bg-error-container text-error" />
        <Stat
          label={net >= 0 ? "Profit" : "Loss"}
          icon={net >= 0 ? "trending_up" : "trending_down"}
          value={`${net < 0 ? "−" : ""}${formatRM(Math.abs(net))}`}
          tone={net >= 0 ? "text-primary" : "text-error"}
          iconClass="bg-secondary-fixed text-secondary"
          sub={moneyIn ? `${Math.round((net / moneyIn) * 100)}% margin` : undefined}
        />
        <Stat
          label="Cash position"
          icon="savings"
          value={`${cash < 0 ? "−" : ""}${formatRM(Math.abs(cash))}`}
          tone="text-primary"
          iconClass="bg-surface-container-high text-secondary"
          sub="All-time in minus out"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <InOutChart ledger={ledger} period={period} />
        <Breakdown entries={inP} />
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
            <Icon name="receipt_long" className="text-secondary" />
            Transactions · {label}
          </h3>
          <div className="flex items-center gap-1 p-1 bg-surface-container-high rounded-lg">
            {(
              [
                ["all", `All (${inP.length})`],
                ["in", "In"],
                ["out", "Out"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-semibold ${filter === k ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty icon="receipt_long">No money recorded for {label}.</Empty>
        ) : (
          <ul className="divide-y divide-outline-variant/20">
            {rows.map((e) => {
              const c = categoryOf(e.category);
              return (
                <li key={e.key} className="flex items-center gap-3 py-3">
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      e.type === "in" ? "bg-tertiary-fixed text-tertiary" : "bg-error-container/70 text-error"
                    }`}
                  >
                    <Icon name={c.icon} className="text-lg" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-medium text-on-surface truncate">{e.label}</p>
                    <p className="text-label-md text-outline truncate">
                      {formatDate(e.date, { day: "numeric", month: "short" })} · {c.label} · {PAY_METHODS[e.method]}
                      {e.by && ` · by ${e.by}`}
                    </p>
                  </div>
                  <span className={`text-body-md font-semibold tabular-nums whitespace-nowrap ${e.type === "in" ? "text-tertiary" : "text-error"}`}>
                    {e.type === "in" ? "+" : "−"}
                    {formatRM2(e.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(e)}
                    title={e.source.kind === "payment" ? "Open booking payments" : "Delete"}
                    aria-label={e.source.kind === "payment" ? "Open booking payments" : "Delete"}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-outline hover:bg-surface-container-high hover:text-on-surface"
                  >
                    <Icon name={e.source.kind === "payment" ? "open_in_new" : "delete"} className="text-base" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, icon, value, tone, iconClass, sub }: { label: string; icon: string; value: string; tone: string; iconClass: string; sub?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-md uppercase tracking-wide text-on-surface-variant">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon name={icon} className="text-lg" />
        </span>
      </div>
      <div className={`mt-2 text-headline-md sm:text-headline-xl font-bold tabular-nums ${tone}`}>{value}</div>
      {sub && <p className="text-label-md text-outline mt-0.5">{sub}</p>}
    </Card>
  );
}

function InOutChart({ ledger, period }: { ledger: LedgerEntry[]; period: Period }) {
  // Six months ending at the selected month (or December of the selected year)
  const endMonth = period.kind === "month" ? period.month : 11;
  const months = Array.from({ length: 6 }, (_, i) => new Date(period.year, endMonth - 5 + i, 1));
  const series = months.map((m) => {
    const p: Period = { kind: "month", year: m.getFullYear(), month: m.getMonth() };
    const xs = ledger.filter((e) => inPeriod(e.date, p));
    return { m, in: sumOf(xs, "in"), out: sumOf(xs, "out") };
  });
  const max = Math.max(1, ...series.flatMap((s) => [s.in, s.out]));

  return (
    <Card className="lg:col-span-7 p-4 sm:p-6 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <h3 className="text-headline-md text-primary flex items-center gap-2">
          <Icon name="bar_chart" className="text-secondary" filled />
          In vs out
        </h3>
        <div className="flex items-center gap-4 text-label-md">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-tertiary" />
            In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-error/70" />
            Out
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-52 grid grid-cols-6 gap-2 sm:gap-5 items-end">
        {series.map((s) => (
          <div key={s.m.toISOString()} className="h-full flex flex-col justify-end items-center gap-2">
            <div className="w-full h-full flex items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-6 rounded-t bg-tertiary"
                style={{ height: `${Math.max(1, (s.in / max) * 100)}%` }}
                title={`In ${formatRM(s.in)}`}
              />
              <div
                className="w-1/2 max-w-6 rounded-t bg-error/70"
                style={{ height: `${Math.max(1, (s.out / max) * 100)}%` }}
                title={`Out ${formatRM(s.out)}`}
              />
            </div>
            <span className="text-label-md text-on-surface">{s.m.toLocaleDateString("en-MY", { month: "short" })}</span>
            <span className={`text-label-sm tabular-nums ${s.in - s.out >= 0 ? "text-tertiary" : "text-error"}`}>
              {s.in - s.out >= 0 ? "+" : "−"}
              {formatRM(Math.abs(s.in - s.out)).replace("RM", "")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Breakdown({ entries }: { entries: LedgerEntry[] }) {
  const [type, setType] = useState<"out" | "in">("out");
  const totals = new Map<string, number>();
  for (const e of entries) if (e.type === type) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  const list = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = list.reduce((s, [, v]) => s + v, 0);

  return (
    <Card className="lg:col-span-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-headline-md text-primary">Where it {type === "out" ? "went" : "came from"}</h3>
        <div className="flex items-center gap-1 p-1 bg-surface-container-high rounded-lg">
          {(["out", "in"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-2.5 py-1 rounded-md text-label-md font-semibold ${type === t ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
            >
              {t === "out" ? "Out" : "In"}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <Empty icon="donut_small">Nothing yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map(([cat, v]) => {
            const c = categoryOf(cat);
            return (
              <li key={cat}>
                <div className="flex items-center justify-between gap-2 text-body-sm mb-1">
                  <span className="flex items-center gap-1.5">
                    <Icon name={c.icon} className="text-base text-on-surface-variant" />
                    {c.label}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {formatRM(v)} <span className="text-outline font-normal">· {Math.round((v / total) * 100)}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                  <div className={`h-full rounded-full ${type === "out" ? "bg-error/70" : "bg-tertiary"}`} style={{ width: `${(v / total) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
