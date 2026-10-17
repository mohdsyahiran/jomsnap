"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { StockItem } from "@/lib/types";
import { Button, Card, Empty, Field, Icon, inputClass, Modal, PanelHeader, Pill } from "../ui";

export function Stock() {
  const { data, dispatch } = useStore();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const low = data.stock.filter((s) => s.qty <= s.threshold);

  const [restockOpen, setRestockOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="inventory_2"
        iconClass="bg-error-container text-on-error-container"
        title="Stock & Consumables"
        subtitle="Recording supplies for a booking deducts 1 media roll + 1 ribbon (+1 guestbook for Standard/Premium). Deleting the booking returns them."
      >
        <Button variant="primary" icon="add_box" onClick={() => setRestockOpen(true)}>
          Restock
        </Button>
      </PanelHeader>

      {low.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-error-container/60 text-on-error-container">
          <Icon name="warning" className="text-xl text-error" />
          <div>
            <p className="font-semibold text-error">
              {low.length} low stock alert{low.length > 1 ? "s" : ""}
            </p>
            <p className="text-body-sm">{low.map((s) => `${s.name}: ${s.qty} left`).join(" · ")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {data.stock.map((s) => (
          <StockCard key={s.id} s={s} onDelta={(delta) => dispatch({ type: "adjustStock", id: s.id, delta })} />
        ))}
      </div>

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

function StockCard({ s, onDelta }: { s: StockItem; onDelta: (d: number) => void }) {
  const pct = Math.min(100, Math.round((s.qty / Math.max(1, s.capacity)) * 100));
  const critical = s.qty <= Math.ceil(s.threshold / 2);
  const low = s.qty <= s.threshold;
  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-label-md font-semibold text-primary">{s.name}</span>
          {critical ? (
            <Pill className="bg-error-container text-on-error-container animate-pulse">Critical</Pill>
          ) : low ? (
            <Pill className="bg-secondary-fixed text-on-secondary-fixed">Low</Pill>
          ) : (
            <Pill className="bg-tertiary-fixed text-on-tertiary-fixed">OK</Pill>
          )}
        </div>
        <div className={`text-headline-xl font-bold tabular-nums ${critical ? "text-error" : "text-primary"}`}>
          {s.qty} <span className="text-body-sm text-outline font-normal">{s.unit}</span>
        </div>
        <p className="text-body-sm text-on-surface-variant">Reorder at ≤ {s.threshold}</p>
      </div>
      <div className="mt-4">
        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${critical ? "bg-error" : low ? "bg-secondary" : "bg-tertiary"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-label-sm text-outline">{pct}% of {s.capacity}</span>
          <div className="flex gap-1.5">
            <Button className="w-9 h-9 px-0" onClick={() => onDelta(-1)} disabled={s.qty === 0} aria-label={`Use one ${s.name}`}>
              <Icon name="remove" />
            </Button>
            <Button className="w-9 h-9 px-0" onClick={() => onDelta(1)} aria-label={`Add one ${s.name}`}>
              <Icon name="add" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RestockForm({ stock, onDone }: { stock: StockItem[]; onDone: () => void }) {
  const { dispatch } = useStore();
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
