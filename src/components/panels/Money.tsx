"use client";

import { useState } from "react";
import { categoryOf, PAY_METHODS } from "@/lib/constants";
import { formatDate, formatRM, formatRM2, toISODate } from "@/lib/format";
import { instalmentsOf } from "@/lib/instalments";
import { buildLedger, exportLedgerCSV, type LedgerEntry } from "@/lib/ledger";
import { useStore } from "@/lib/store";
import { Button, Card, Empty, Field, Icon, inputClass, PanelHeader } from "../ui";

type Period = { kind: "month" | "year"; year: number; month: number };

const inPeriod = (date: string, p: Period) => {
  const [y, m] = date.split("-").map(Number);
  return y === p.year && (p.kind === "year" || m - 1 === p.month);
};
const sumOf = (xs: LedgerEntry[], type: "in" | "out") => xs.reduce((s, e) => s + (e.type === type ? e.amount : 0), 0);

export function Money({
  onAdd,
  onOpenPayment,
  onOpenBooking,
}: {
  onAdd: (t: "in" | "out") => void;
  onOpenPayment: (bookingId: string) => void;
  onOpenBooking: (bookingId: string) => void;
}) {
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
    if (e.source.kind === "cost") return onOpenBooking(e.source.bookingId);
    if (e.source.kind === "instalment") return;
    if (confirm(`Delete "${e.label}" (${formatRM2(e.amount)})?`)) dispatch({ type: "deleteTxn", id: e.source.id });
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="account_balance"
        iconClass="bg-tertiary-fixed text-on-tertiary-fixed"
        title="Money In & Out"
        subtitle="Booking payments and booking costs are counted automatically. Add other expenses here, like supplies and instalments."
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <BankCard ledger={ledger} />
        <InstalmentsCard />
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
                      {formatDate(e.date, { day: "numeric", month: "short" })} · {c.label} · {e.method ? PAY_METHODS[e.method] : "Booking cost"}
                      {e.by && ` · by ${e.by}`}
                    </p>
                  </div>
                  <span className={`text-body-md font-semibold tabular-nums whitespace-nowrap ${e.type === "in" ? "text-tertiary" : "text-error"}`}>
                    {e.type === "in" ? "+" : "−"}
                    {formatRM2(e.amount)}
                  </span>
                  {e.source.kind === "instalment" ? (
                    <span className="w-8 h-8 inline-flex items-center justify-center text-outline" title="Worked out from the ROI tab">
                      <Icon name="autorenew" className="text-base" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => remove(e)}
                      title={e.source.kind === "payment" ? "Open booking payments" : e.source.kind === "cost" ? "Open booking costs" : "Delete"}
                      aria-label={e.source.kind === "payment" ? "Open booking payments" : e.source.kind === "cost" ? "Open booking costs" : "Delete"}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-outline hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <Icon name={e.source.kind === "txn" ? "delete" : "open_in_new"} className="text-base" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** The real bank balance next to what the records add up to, step by step; the gap is money not recorded yet */
function BankCard({ ledger }: { ledger: LedgerEntry[] }) {
  const { data, dispatch } = useStore();
  const bank = data.bank;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [asOf, setAsOf] = useState("");
  const total = (f: (e: LedgerEntry) => boolean) => ledger.reduce((s, e) => s + (f(e) ? e.amount : 0), 0);
  const steps = [
    { label: "Client payments", sub: "All payments recorded on bookings", amount: total((e) => e.source.kind === "payment"), sign: 1 },
    { label: "Other money in", sub: "Money in entries, e.g. owner capital", amount: total((e) => e.type === "in" && e.source.kind === "txn"), sign: 1 },
    { label: "Booking costs", sub: "Crew, transport, guestbook, designer… on each booking", amount: total((e) => e.source.kind === "cost"), sign: -1 },
    { label: "Instalments paid so far", sub: "Worked out from the investments on the ROI tab", amount: total((e) => e.source.kind === "instalment"), sign: -1 },
    { label: "Other money out", sub: "Money out entries added here", amount: total((e) => e.type === "out" && e.source.kind === "txn"), sign: -1 },
  ];
  const expected = steps.reduce((s, x) => s + x.sign * x.amount, 0);
  const gap = bank ? Math.round((expected - bank.amount) * 100) / 100 : 0;
  const rm = (n: number) => `${n < 0 ? "−" : ""}${formatRM2(Math.abs(n))}`;
  const matches = Math.abs(gap) < 1;

  const open = () => {
    setAmount(bank?.amount ?? "");
    setAsOf(toISODate(new Date()));
    setEditing(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount === "" || amount < 0) return;
    if (await dispatch({ type: "setBank", amount: Number(amount), asOf })) setEditing(false);
  };

  return (
    <Card className="lg:col-span-7 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
            <Icon name="account_balance" className="text-secondary" />
            Bank balance check
          </h3>
          <p className="text-body-sm text-on-surface-variant">What should be in the business account, step by step, against what is really there.</p>
        </div>
        {!editing && (
          <Button icon={bank ? "edit" : "add"} onClick={open}>
            {bank ? "Update balance" : "Enter balance"}
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end p-3 rounded-xl bg-surface-container-low">
          <Field label="Balance in the bank app (RM)">
            <input
              required
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              autoFocus
            />
          </Field>
          <Field label="Checked on">
            <input required type="date" className={inputClass} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" icon="check">
              Save
            </Button>
          </div>
        </form>
      )}

      <dl className="text-body-sm divide-y divide-outline-variant/20">
        {steps.map((x) => (
          <div key={x.label} className={`flex items-start justify-between gap-3 py-2 ${x.amount ? "" : "text-outline"}`}>
            <dt>
              <span className={x.amount ? "text-on-surface" : ""}>{x.label}</span>
              <span className="block text-label-md text-outline">{x.sub}</span>
            </dt>
            <dd className={`tabular-nums font-semibold ${x.amount ? (x.sign > 0 ? "text-tertiary" : "text-error") : ""}`}>
              {x.sign > 0 ? "+" : "−"}
              {formatRM2(x.amount)}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-2.5 text-body-md font-bold text-primary">
          <dt>Should be in the bank</dt>
          <dd className="tabular-nums">{rm(expected)}</dd>
        </div>
        {bank && (
          <>
            <div className="flex items-center justify-between gap-3 py-2.5 text-body-md font-bold text-primary">
              <dt>
                Actually in the bank
                <span className="block text-label-md font-normal text-outline">
                  As of {formatDate(bank.asOf)}
                  {bank.by && ` · by ${bank.by}`}
                </span>
              </dt>
              <dd className="tabular-nums">{rm(bank.amount)}</dd>
            </div>
            <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${matches ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-secondary-fixed text-on-secondary-fixed"}`}>
              <dt className="font-semibold">
                {matches ? "Matches" : gap > 0 ? "Not recorded: less in the bank" : "Not recorded: more in the bank"}
              </dt>
              <dd className="tabular-nums text-headline-sm font-bold">{matches ? "✓" : formatRM2(Math.abs(gap))}</dd>
            </div>
          </>
        )}
      </dl>
      {!bank && !editing && <p className="mt-3 text-body-sm text-on-surface-variant">Enter the balance from your bank app to see if the records match.</p>}
      {bank && !matches && (
        <p className="mt-3 text-body-sm text-on-surface-variant">
          {gap > 0
            ? "Money left the account without being recorded, or a client paid into another account. Check the bank statement for payments not listed below (e.g. items bought from this account, transfers to an owner) and add them under Money out."
            : "Money came into the account without being recorded, e.g. owner capital. Add it under Money in."}
        </p>
      )}
    </Card>
  );
}

/** Instalments still running on investments, from the ROI tab */
function InstalmentsCard() {
  const { data } = useStore();
  const today = toISODate(new Date());
  const running = data.investments
    .map((i) => ({ i, plan: instalmentsOf(i, today) }))
    .filter((x): x is { i: (typeof data.investments)[number]; plan: NonNullable<ReturnType<typeof instalmentsOf>> } => !!x.plan && x.plan.left > 0)
    .sort((a, b) => (a.plan.nextDue ?? "").localeCompare(b.plan.nextDue ?? ""));
  const left = running.reduce((s, x) => s + x.plan.left, 0);
  const monthly = running.reduce((s, x) => s + x.plan.monthly, 0);

  return (
    <Card className="lg:col-span-5 p-4 sm:p-6">
      <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2 mb-4">
        <Icon name="credit_card" className="text-secondary" />
        Pending instalments
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-secondary-fixed p-3 text-on-secondary-fixed">
          <p className="text-label-md uppercase tracking-wide">Left to pay</p>
          <p className="mt-1 text-headline-sm font-bold tabular-nums">{formatRM2(left)}</p>
        </div>
        <div className="rounded-xl bg-surface-container-low p-3">
          <p className="text-label-md uppercase tracking-wide text-on-surface-variant">Each month</p>
          <p className="mt-1 text-headline-sm font-bold tabular-nums text-primary">{formatRM2(monthly)}</p>
        </div>
      </div>
      {running.length === 0 ? (
        <Empty icon="credit_card">No instalments running.</Empty>
      ) : (
        <ul className="divide-y divide-outline-variant/20 text-body-sm">
          {running.map(({ i, plan }) => (
            <li key={i.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-semibold text-on-surface truncate">{i.item}</p>
                <p className="text-label-md text-outline">
                  {formatRM2(plan.monthly)}/mo · {plan.paid} of {plan.months} paid
                  {plan.nextDue && ` · next ${formatDate(plan.nextDue, { day: "numeric", month: "short" })}`}
                </p>
              </div>
              <span className="tabular-nums font-semibold text-secondary whitespace-nowrap">{formatRM2(plan.left)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-label-md text-outline">
        Counted as paid from the business account once each due date passes. Change items on the ROI tab.
      </p>
    </Card>
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
