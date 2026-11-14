"use client";

import { useState } from "react";
import { INVEST_METHODS, PACKAGES, PARTNERS } from "@/lib/constants";
import { formatDate, formatRM, formatRM2, toISODate } from "@/lib/format";
import { instalmentsOf } from "@/lib/instalments";
import { buildLedger, INSTALMENT_CATEGORY } from "@/lib/ledger";
import { useStore } from "@/lib/store";
import type { InvestMethod, Investment, Partner } from "@/lib/types";
import { Button, Card, Empty, Field, Icon, inputClass, Modal, PanelHeader } from "../ui";

// Money out under these also counts as investment, so equipment logged in Money In & Out isn't lost
const INVESTMENT_CATEGORIES = ["equipment"];
// Instalments and owner pay-backs are for investments already counted in full, so they aren't running costs either
const NOT_RUNNING = [...INVESTMENT_CATEGORIES, INSTALMENT_CATEGORY, "investment-repay"];
// Owner capital is money put in, not money earned
const NOT_REVENUE = ["capital"];
const PLAN_MONTHS = [12, 6];
const PLAN_PACKAGES = (["premium", "standard", "basic"] as const).map((id) => ({ id, ...PACKAGES[id] }));

/** "Syahiran", or "Syahiran RM900 · Mullah RM300" when split */
function payerLabel(p: Investment["paidBy"]) {
  const parts = PARTNERS.filter((k) => p?.[k]);
  if (parts.length === 1) return parts[0];
  return parts.map((k) => `${k} ${formatRM2(p![k]!)}`).join(" · ");
}

const signed = (n: number) => `${n < 0 ? "−" : ""}${formatRM2(Math.abs(n))}`;

export function Roi() {
  const { data, dispatch } = useStore();
  // null: closed; "new": adding; otherwise the item being edited
  const [editing, setEditing] = useState<Investment | "new" | null>(null);
  const ledger = buildLedger(data);
  const sum = (f: (e: (typeof ledger)[number]) => boolean) => ledger.reduce((s, e) => s + (f(e) ? e.amount : 0), 0);

  const items = [...data.investments].sort((a, b) => a.date.localeCompare(b.date));
  const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
  const equipmentOut = sum((e) => e.type === "out" && INVESTMENT_CATEGORIES.includes(e.category));
  const investment = itemsTotal + equipmentOut;
  const revenue = sum((e) => e.type === "in" && !NOT_REVENUE.includes(e.category));
  const runningCosts = sum((e) => e.type === "out" && !NOT_RUNNING.includes(e.category));

  const operatingProfit = revenue - runningCosts;
  const netProfit = operatingProfit - investment;
  const roi = investment ? (netProfit / investment) * 100 : 0;
  const recoveredPct = investment ? Math.min(100, Math.max(0, (operatingProfit / investment) * 100)) : 0;
  const remaining = Math.max(0, investment - Math.max(0, operatingProfit));

  const remove = (i: Investment) => {
    if (confirm(`Delete "${i.item}" (${formatRM2(i.amount)})?`)) dispatch({ type: "deleteInvestment", id: i.id });
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="monitoring"
        iconClass="bg-tertiary-fixed text-on-tertiary-fixed"
        title="Return on Investment"
        subtitle="How much of the startup cost the business has earned back, and what it takes to recover the rest."
      >
        <Button variant="primary" icon="add" onClick={() => setEditing("new")}>
          Add investment
        </Button>
      </PanelHeader>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5">
        <Stat label="Revenue" icon="south_west" value={formatRM(revenue)} tone="text-tertiary" iconClass="bg-tertiary-fixed text-tertiary" sub="Payments & other income" />
        <Stat label="Investment" icon="photo_camera" value={formatRM(investment)} tone="text-primary" iconClass="bg-surface-container-high text-secondary" sub={`${items.length} item${items.length === 1 ? "" : "s"}`} />
        <Stat label="Running costs" icon="north_east" value={formatRM(runningCosts)} tone="text-error" iconClass="bg-error-container text-error" sub="Money out, excl. equipment" />
        <Stat
          label="ROI"
          icon={roi >= 0 ? "trending_up" : "trending_down"}
          value={`${roi.toFixed(1)}%`}
          tone={roi >= 0 ? "text-tertiary" : "text-error"}
          iconClass="bg-secondary-fixed text-secondary"
          sub={`Net ${signed(netProfit)}`}
        />
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
            <Icon name="savings" className="text-secondary" />
            Investment recovered
          </h3>
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            {formatRM2(Math.max(0, operatingProfit))} of {formatRM2(investment)}
          </span>
        </div>
        <div className="h-3 rounded-full bg-surface-container-high overflow-hidden">
          <div className="h-full rounded-full bg-tertiary" style={{ width: `${recoveredPct}%` }} />
        </div>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          {investment === 0
            ? "No investments yet. Add what you bought to start the business."
            : remaining > 0
              ? `${Math.round(recoveredPct)}% recovered · ${formatRM2(remaining)} still to earn back.`
              : "Fully recovered — everything from here is profit."}
        </p>
      </Card>

      <InvestmentList items={items} equipmentOut={equipmentOut} onEdit={setEditing} onRemove={remove} />

      <Plan remaining={remaining} />

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add investment" : "Edit investment"}>
        {editing && <InvestmentForm key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function InvestmentList({
  items,
  equipmentOut,
  onEdit,
  onRemove,
}: {
  items: Investment[];
  equipmentOut: number;
  onEdit: (i: Investment) => void;
  onRemove: (i: Investment) => void;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const today = toISODate(new Date());
  const plans = new Map(items.map((i) => [i.id, instalmentsOf(i, today)]));
  const running = [...plans.values()].filter((p) => p && p.left > 0);
  const left = running.reduce((s, p) => s + p!.left, 0);
  const dueMonthly = running.reduce((s, p) => s + p!.monthly, 0);
  const byMethod = (Object.keys(INVEST_METHODS) as InvestMethod[])
    .map((m) => ({ m, total: items.filter((i) => i.method === m).reduce((s, i) => s + i.amount, 0) }))
    .filter((x) => x.total > 0);
  const byPartner = PARTNERS.map((k) => ({ k, total: items.reduce((s, i) => s + (i.paidBy?.[k] ?? 0), 0) }));
  const unassigned = items.filter((i) => !i.paidBy).length;

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2 mb-4">
        <Icon name="inventory" className="text-secondary" />
        Investments
      </h3>
      {!items.length ? (
        <Empty icon="photo_camera">Nothing added yet. Use &quot;Add investment&quot; for each purchase.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-label-md text-on-surface-variant border-b border-outline-variant/40">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 px-3 font-semibold">Item</th>
                <th className="py-2 px-3 font-semibold">Paid by</th>
                <th className="py-2 px-3 font-semibold">Method</th>
                <th className="py-2 px-3 font-semibold text-right">Amount</th>
                <th className="py-2 px-3 font-semibold text-right">Instalments</th>
                <th className="py-2 px-3 font-semibold text-right">Left to pay</th>
                <th className="py-2 pl-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const plan = plans.get(i.id);
                return (
                  <tr key={i.id} className="border-b border-outline-variant/20">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-on-surface-variant">{formatDate(i.date)}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-on-surface">{i.item}</div>
                      {i.note && <div className="text-label-md text-on-surface-variant">{i.note}</div>}
                    </td>
                    <td className={`py-2.5 px-3 ${i.paidBy ? "" : "text-outline"}`}>{i.paidBy ? payerLabel(i.paidBy) : "Not set"}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{INVEST_METHODS[i.method]}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{formatRM2(i.amount)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-on-surface-variant">
                      {plan ? (
                        <>
                          <div>
                            {formatRM2(plan.monthly)} × {plan.months}
                          </div>
                          <div className={`text-label-md ${plan.left ? "" : "text-tertiary font-semibold"}`}>
                            {plan.left ? `${plan.paid} of ${plan.months} paid · ${plan.months - plan.paid} left` : "Done"}
                          </div>
                          {plan.settled > 0 && <div className="text-label-md text-tertiary">{formatRM2(plan.settled)} paid off early</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${plan?.left ? "font-semibold text-secondary" : "text-outline"}`}>
                      {plan?.left ? formatRM2(plan.left) : "—"}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => onEdit(i)} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" aria-label={`Edit ${i.item}`}>
                        <Icon name="edit" className="text-lg" />
                      </button>
                      <button type="button" onClick={() => onRemove(i)} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant" aria-label={`Delete ${i.item}`}>
                        <Icon name="delete" className="text-lg" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold text-primary">
                <td className="pt-3 pr-3" colSpan={4}>
                  Total
                </td>
                <td className="pt-3 px-3 text-right tabular-nums">{formatRM2(total)}</td>
                <td className="pt-3 px-3 text-right tabular-nums whitespace-nowrap">{dueMonthly ? `${formatRM2(dueMonthly)}/mo` : ""}</td>
                <td className="pt-3 px-3 text-right tabular-nums whitespace-nowrap text-secondary">{left ? formatRM2(left) : ""}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {running.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-secondary-fixed p-4 text-on-secondary-fixed">
            <p className="text-label-md uppercase tracking-wide">Instalments left to pay</p>
            <p className="mt-1 text-headline-md font-bold tabular-nums">{formatRM2(left)}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-label-md uppercase tracking-wide text-on-surface-variant">Due each month now</p>
            <p className="mt-1 text-headline-md font-bold tabular-nums text-primary">{formatRM2(dueMonthly)}</p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-label-md uppercase tracking-wide text-on-surface-variant">Still running</p>
            <p className="mt-1 text-headline-md font-bold tabular-nums text-primary">
              {running.length} item{running.length === 1 ? "" : "s"}
            </p>
          </div>
          <p className="sm:col-span-3 text-label-md text-on-surface-variant">
            Counted as one instalment a month, starting a month after the purchase date. Your card or SPayLater statement may be one month ahead or behind.
          </p>
        </div>
      )}
      {items.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-label-md">
          {byPartner.map((x) => (
            <span key={x.k} className="px-3 py-1.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed">
              {x.k} paid: <strong className="tabular-nums">{formatRM2(x.total)}</strong>
            </span>
          ))}
          {unassigned > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-error-container text-on-error-container">
              {unassigned} item{unassigned === 1 ? "" : "s"} without a payer
            </span>
          )}
        </div>
      )}
      {(byMethod.length > 0 || equipmentOut > 0) && (
        <div className="mt-2 flex flex-wrap gap-2 text-label-md">
          {byMethod.map((x) => (
            <span key={x.m} className="px-3 py-1.5 rounded-lg bg-surface-container-low">
              {INVEST_METHODS[x.m]}: <strong className="tabular-nums">{formatRM2(x.total)}</strong>
            </span>
          ))}
          {equipmentOut > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-secondary-fixed/50 text-on-secondary-fixed">
              + {formatRM2(equipmentOut)} logged as Equipment in Money In & Out
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function Plan({ remaining }: { remaining: number }) {
  const { data, dispatch } = useStore();
  const [cost, setCost] = useState(String(data.costPerEvent));
  const eventCost = Math.max(0, Number(cost) || 0);
  const save = () => {
    if (eventCost !== data.costPerEvent) dispatch({ type: "setCostPerEvent", amount: eventCost });
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2 mb-1">
            <Icon name="event_available" className="text-secondary" />
            Bookings needed per month
          </h3>
          <p className="text-body-sm text-on-surface-variant">
            To recover the remaining {formatRM2(remaining)}:{" "}
            {PLAN_MONTHS.map((m, i) => (
              <span key={m}>
                {i > 0 && " · "}
                <strong className="tabular-nums">{formatRM2(remaining / m)}</strong>/month over {m} months
              </span>
            ))}
          </p>
        </div>
        <Field label="Cost per event (RM)" className="sm:w-56 shrink-0">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            className={inputClass}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            title="Paper, ink, transport and crew for one event"
          />
        </Field>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-left text-label-md text-on-surface-variant border-b border-outline-variant/40">
              <th className="py-2 pr-3 font-semibold">Package</th>
              <th className="py-2 px-3 font-semibold text-right">Price</th>
              <th className="py-2 px-3 font-semibold text-right">Profit / booking</th>
              {PLAN_MONTHS.map((m) => (
                <th key={m} className="py-2 pl-3 font-semibold text-right">
                  {m}-month plan
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_PACKAGES.map((p) => {
              const profit = p.price - eventCost;
              return (
                <tr key={p.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-on-surface">{p.label}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatRM(p.price)}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums ${profit > 0 ? "" : "text-error"}`}>{formatRM(profit)}</td>
                  {PLAN_MONTHS.map((m) => (
                    <td key={m} className="py-2.5 pl-3 text-right tabular-nums font-bold text-primary">
                      {profit > 0 ? Math.ceil(remaining / m / profit) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-label-md text-on-surface-variant">Each row assumes only that package; mix and match in practice.</p>
    </Card>
  );
}

type PayerChoice = Partner | "split";

const initialPayer = (p: Investment["paidBy"]): PayerChoice | "" => {
  const parts = PARTNERS.filter((k) => p?.[k]);
  return parts.length > 1 ? "split" : (parts[0] ?? "");
};

function InvestmentForm({ existing, onDone }: { existing?: Investment; onDone: () => void }) {
  const { dispatch } = useStore();
  const [item, setItem] = useState(existing?.item ?? "");
  const [amount, setAmount] = useState<number | "">(existing?.amount ?? "");
  const [date, setDate] = useState(() => existing?.date ?? toISODate(new Date()));
  const [method, setMethod] = useState<InvestMethod>(existing?.method ?? "cash");
  const [months, setMonths] = useState<number | "">(existing?.months ?? "");
  const [settled, setSettled] = useState<number | "">(existing?.settled ?? "");
  const [payer, setPayer] = useState<PayerChoice | "">(() => (existing ? initialPayer(existing.paidBy) : "Syahiran"));
  // When split, Syahiran's share is entered and Mullah pays the rest
  const [share, setShare] = useState<number | "">(existing?.paidBy?.Syahiran ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  const total = Number(amount) || 0;
  const rest = Math.round((total - (Number(share) || 0)) * 100) / 100;
  const splitOk = payer !== "split" || (share !== "" && share > 0 && rest > 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim() || !amount || amount <= 0 || !payer || !splitOk) return;
    const paidBy = payer === "split" ? { Syahiran: Number(share), Mullah: rest } : { [payer]: total };
    const entry = { item: item.trim(), amount: total, date, method, months: months && months > 1 ? months : undefined, settled: months && months > 1 && settled && settled > 0 ? Number(settled) : undefined, paidBy, note: note.trim() || undefined };
    dispatch(existing ? { type: "updateInvestment", id: existing.id, entry } : { type: "addInvestment", entry });
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Item" className="col-span-2">
        <input required maxLength={100} className={inputClass} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. DNP Printer" autoFocus />
      </Field>
      <Field label="Amount (RM)">
        <input
          required
          type="number"
          min={0.01}
          step="0.01"
          inputMode="decimal"
          className={inputClass}
          value={amount}
          onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </Field>
      <Field label="Date">
        <input required type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="col-span-2">
        <span className="text-label-md font-semibold text-on-surface-variant">Paid by</span>
        <div className="mt-1 grid grid-cols-3 gap-1 p-1 bg-surface-container-high rounded-lg">
          {([...PARTNERS, "split"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPayer(k)}
              className={`py-2 rounded-lg text-label-md font-semibold ${payer === k ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
            >
              {k === "split" ? "Both" : k}
            </button>
          ))}
        </div>
        {!payer && <p className="mt-1.5 text-label-md text-error">Choose who paid.</p>}
      </div>
      {payer === "split" && (
        <>
          <Field label="Syahiran paid (RM)">
            <input
              required
              type="number"
              min={0.01}
              step="0.01"
              inputMode="decimal"
              className={inputClass}
              value={share}
              onChange={(e) => setShare(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Mullah paid (RM)">
            <input readOnly tabIndex={-1} className={`${inputClass} ${rest > 0 ? "" : "text-error"}`} value={total ? rest.toFixed(2) : ""} />
          </Field>
        </>
      )}
      <Field label="Payment method">
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as InvestMethod)}>
          {(Object.keys(INVEST_METHODS) as InvestMethod[]).map((k) => (
            <option key={k} value={k}>
              {INVEST_METHODS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Instalment months (optional)">
        <input
          type="number"
          min={1}
          max={60}
          step="1"
          inputMode="numeric"
          className={inputClass}
          value={months}
          onChange={(e) => setMonths(e.target.value === "" ? "" : Math.round(Number(e.target.value)))}
          placeholder="e.g. 12"
        />
      </Field>
      {months !== "" && months > 1 && (
        <Field label="Already paid off (RM, optional)" className="col-span-2">
          <input
            type="number"
            min={0}
            max={total || undefined}
            step="0.01"
            inputMode="decimal"
            className={inputClass}
            value={settled}
            onChange={(e) => setSettled(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="e.g. 300 if one owner's share was paid in one go"
          />
        </Field>
      )}
      <Field label="Notes" className="col-span-2">
        <input maxLength={200} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 12 months installment" />
      </Field>
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="check" disabled={!payer || !splitOk}>
          Save
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, icon, value, tone, iconClass, sub }: { label: string; icon: string; value: string; tone: string; iconClass: string; sub?: string }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between mb-3">
        <span className="text-label-md font-medium uppercase tracking-wide text-on-surface">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>
          <Icon name={icon} className="text-lg" />
        </span>
      </div>
      <div className={`text-headline-md sm:text-headline-xl font-bold tabular-nums ${tone}`}>{value}</div>
      {sub && <p className="text-label-md text-on-surface-variant mt-1">{sub}</p>}
    </Card>
  );
}
