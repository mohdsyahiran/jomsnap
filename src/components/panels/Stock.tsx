"use client";

import { useEffect, useState } from "react";
import { guestbookTasks, isLow, stockAlerts, type GuestbookTask } from "@/lib/alerts";
import { GUESTBOOK_LEAD_DAYS, GUESTBOOK_STYLE } from "@/lib/constants";
import { formatDate, parseDate, timeAgo, toISODate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Booking, StockItem } from "@/lib/types";
import { Button, Card, Empty, Field, Icon, inputClass, Modal, PanelHeader, Pill } from "../ui";

export function Stock() {
  const { data, dispatch } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = toISODate(new Date());
  const alerts = stockAlerts(data, today);
  const [restockOpen, setRestockOpen] = useState(false);
  const [ordering, setOrdering] = useState<Booking | null>(null);

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="inventory_2"
        iconClass="bg-error-container text-on-error-container"
        title="Stock & Guestbooks"
        subtitle={`Media rolls: keep at least ${data.stock.find((x) => x.id === "media-4x6")?.min ?? 2}. Guestbooks are ordered per booking, ${GUESTBOOK_LEAD_DAYS} days before the event.`}
      >
        <Button variant="primary" icon="add_box" onClick={() => setRestockOpen(true)}>
          Restock rolls
        </Button>
      </PanelHeader>

      {alerts.count > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-error-container/60 text-on-error-container">
          <Icon name="warning" className="text-xl text-error" />
          <div>
            <p className="font-semibold text-error">
              {alerts.count} thing{alerts.count > 1 ? "s" : ""} need attention
            </p>
            <ul className="text-body-sm">
              {alerts.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {data.stock.map((s) =>
          s.kind === "available" ? (
            <AvailableCard key={s.id} s={s} onSet={(available) => dispatch({ type: "adjustStock", id: s.id, delta: available ? 1 : -1 })} />
          ) : (
            <CountCard key={s.id} s={s} onDelta={(delta) => dispatch({ type: "adjustStock", id: s.id, delta })} />
          ),
        )}
      </div>

      <GuestbookOrders today={today} onOrder={setOrdering} />

      <Modal open={!!ordering} onClose={() => setOrdering(null)} title="Guestbook ordered">
        {ordering && <OrderForm booking={ordering} onDone={() => setOrdering(null)} />}
      </Modal>

      <Modal open={restockOpen} onClose={() => setRestockOpen(false)} title="Restock">
        {restockOpen && <RestockForm stock={data.stock} onDone={() => setRestockOpen(false)} />}
      </Modal>

      <Card className="p-4 sm:p-6">
        <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2 mb-3">
          <Icon name="history" className="text-secondary" />
          Activity log
        </h3>
        {data.audit.length === 0 ? (
          <Empty icon="history">No activity yet.</Empty>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto text-body-sm">
            {data.audit.slice(0, 50).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-container-low">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      { booking: "bg-primary", payment: "bg-tertiary", money: "bg-tertiary", stock: "bg-secondary", system: "bg-outline" }[a.kind]
                    }`}
                  />
                  <span className="truncate">{a.message}</span>
                </span>
                <span className="text-label-sm text-outline whitespace-nowrap">
                  {a.by && `${a.by} · `}
                  {timeAgo(a.at, now)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CountCard({ s, onDelta }: { s: StockItem; onDelta: (d: number) => void }) {
  const low = isLow(s);
  const empty = s.qty === 0;
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-label-md font-semibold text-primary">{s.name}</span>
          {empty ? (
            <Pill className="bg-error-container text-on-error-container animate-pulse">Out of stock</Pill>
          ) : low ? (
            <Pill className="bg-secondary-fixed text-on-secondary-fixed">Low</Pill>
          ) : (
            <Pill className="bg-tertiary-fixed text-on-tertiary-fixed">OK</Pill>
          )}
        </div>
        <div className={`text-headline-xl font-bold tabular-nums ${low ? "text-error" : "text-primary"}`}>
          {s.qty} <span className="text-body-sm text-outline font-normal">{s.unit}</span>
        </div>
        <p className="text-body-sm text-on-surface-variant">OK at {s.min} or more</p>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-label-sm text-outline">{low ? `Buy ${s.min - s.qty} more to be OK` : "Enough for now"}</span>
        <div className="flex gap-1.5">
          <Button className="w-9 h-9 px-0" onClick={() => onDelta(-1)} disabled={s.qty === 0} aria-label={`Use one ${s.name}`}>
            <Icon name="remove" />
          </Button>
          <Button className="w-9 h-9 px-0" onClick={() => onDelta(1)} aria-label={`Add one ${s.name}`}>
            <Icon name="add" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function AvailableCard({ s, onSet }: { s: StockItem; onSet: (available: boolean) => void }) {
  const available = s.qty > 0;
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-label-md font-semibold text-primary">{s.name}</span>
          <Pill className={available ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"}>{available ? "OK" : "Missing"}</Pill>
        </div>
        <div className={`text-headline-xl font-bold ${available ? "text-primary" : "text-error"}`}>{available ? "Available" : "Not available"}</div>
        <p className="text-body-sm text-on-surface-variant">Do we have the props ready for events?</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1 p-1 bg-surface-container-high rounded-lg" role="radiogroup" aria-label={`${s.name} availability`}>
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={available === v}
            onClick={() => available !== v && onSet(v)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-label-md font-semibold ${
              available === v ? (v ? "bg-tertiary-fixed text-on-tertiary-fixed shadow-sm" : "bg-error-container text-on-error-container shadow-sm") : "text-on-surface-variant"
            }`}
          >
            <Icon name={v ? "check_circle" : "cancel"} className="text-base" />
            {v ? "Available" : "Not available"}
          </button>
        ))}
      </div>
    </Card>
  );
}

const URGENCY_STYLE: Record<GuestbookTask["urgency"], string> = {
  late: "bg-error-container text-on-error-container",
  due: "bg-secondary-fixed text-on-secondary-fixed",
  waiting: "bg-secondary-fixed text-on-secondary-fixed",
  ok: "bg-surface-container-highest text-on-surface-variant",
};

function GuestbookOrders({ today, onOrder }: { today: string; onOrder: (b: Booking) => void }) {
  const { data, dispatch } = useStore();
  const tasks = guestbookTasks(data, today);

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
          <Icon name="menu_book" className="text-secondary" />
          Guestbook orders
        </h3>
        <span className="text-label-md text-on-surface-variant">Order at least {GUESTBOOK_LEAD_DAYS} days before each event</span>
      </div>
      {tasks.length === 0 ? (
        <Empty icon="menu_book">No upcoming bookings with a guestbook.</Empty>
      ) : (
        <ul className="space-y-2">
          {tasks.map(({ booking: b, orderBy, urgency, message }) => {
            const g = b.guestbook!;
            const d = parseDate(b.date);
            return (
              <li key={b.id} className="p-3 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary-container text-on-primary flex flex-col items-center justify-center shrink-0">
                    <span className="text-label-sm uppercase font-bold text-secondary-fixed">{d.toLocaleDateString("en-MY", { month: "short" })}</span>
                    <span className="text-headline-sm font-bold leading-none">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-md font-semibold text-primary">{b.client}</span>
                      <span className="text-label-md text-outline">#{b.code}</span>
                      <Pill className={GUESTBOOK_STYLE[g.status].className}>{GUESTBOOK_STYLE[g.status].label.replace("Guestbook: ", "")}</Pill>
                    </div>
                    <p className="text-label-md text-on-surface-variant flex flex-wrap items-center gap-x-2">
                      <span>Order by {formatDate(orderBy, { weekday: "short", day: "numeric", month: "short" })}</span>
                      {g.orderedAt && <span>· ordered {formatDate(g.orderedAt, { day: "numeric", month: "short" })}</span>}
                      {g.receivedAt && <span>· received {formatDate(g.receivedAt, { day: "numeric", month: "short" })}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Pill className={URGENCY_STYLE[urgency]}>
                    {urgency !== "ok" && <Icon name={urgency === "late" ? "error" : "schedule"} className="text-sm" />}
                    {message}
                  </Pill>
                  {g.status === "pending" && (
                    <Button variant="primary" icon="shopping_cart" onClick={() => onOrder(b)}>
                      Mark ordered
                    </Button>
                  )}
                  {g.status === "ordered" && (
                    <Button icon="inventory" onClick={() => dispatch({ type: "setGuestbook", id: b.id, status: "received" })}>
                      Mark received
                    </Button>
                  )}
                  {g.status !== "pending" && (
                    <button
                      type="button"
                      className="text-label-md text-outline hover:text-on-surface px-1"
                      onClick={() => dispatch({ type: "setGuestbook", id: b.id, status: g.status === "received" ? "ordered" : "pending" })}
                    >
                      Undo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function OrderForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const { dispatch } = useStore();
  const [cost, setCost] = useState<number | "">("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "setGuestbook", id: booking.id, status: "ordered", cost: cost ? Number(cost) : undefined });
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-body-sm text-on-surface-variant">
        Guestbook for <strong className="text-on-surface">#{booking.code} {booking.client}</strong> on {formatDate(booking.date)}.
      </p>
      <Field label="Cost RM (optional)">
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          className={inputClass}
          value={cost}
          onChange={(e) => setCost(e.target.value === "" ? "" : Number(e.target.value))}
          autoFocus
        />
      </Field>
      <p className="text-label-md text-outline">With a cost, it&apos;s also recorded under Money In &amp; Out as a supplies expense.</p>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="check">
          Mark ordered
        </Button>
      </div>
    </form>
  );
}

function RestockForm({ stock: all, onDone }: { stock: StockItem[]; onDone: () => void }) {
  const { dispatch } = useStore();
  const stock = all.filter((s) => s.kind === "count");
  const [id, setId] = useState(stock[0]?.id ?? "");
  const [qty, setQty] = useState(10);
  const [cost, setCost] = useState<number | "">("");
  const item = stock.find((s) => s.id === id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || qty <= 0) return;
    dispatch({ type: "adjustStock", id: item.id, delta: qty, cost: cost ? Number(cost) : undefined });
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Item" className="col-span-2">
        <select className={inputClass} value={id} onChange={(e) => setId(e.target.value)}>
          {stock.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.qty} {s.unit} now)
            </option>
          ))}
        </select>
      </Field>
      <Field label={`Quantity arrived${item ? ` (${item.unit})` : ""}`}>
        <input required type="number" min={1} className={inputClass} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
      </Field>
      <Field label="Total cost RM (optional)">
        <input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          className={inputClass}
          value={cost}
          onChange={(e) => setCost(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </Field>
      <p className="col-span-2 text-label-md text-outline">With a cost, this is also recorded under Money In &amp; Out as a supplies expense.</p>
      <div className="col-span-2 flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="add_box">
          Add to stock
        </Button>
      </div>
    </form>
  );
}
