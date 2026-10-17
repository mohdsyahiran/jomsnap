"use client";

import { useState } from "react";
import { MONEY_IN_CATEGORIES, MONEY_OUT_CATEGORIES, PAY_METHODS } from "@/lib/constants";
import { toISODate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { PayMethod } from "@/lib/types";
import { Button, Field, Icon, inputClass, Modal } from "./ui";

export function MoneyModal({ type, open, onClose }: { type: "in" | "out"; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={type === "in" ? "Record money in" : "Record money out"}>
      {open && <MoneyForm key={type} initialType={type} onDone={onClose} />}
    </Modal>
  );
}

function MoneyForm({ initialType, onDone }: { initialType: "in" | "out"; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const [type, setType] = useState(initialType);
  // Booking payments go through the booking so balances stay right
  const inCats = MONEY_IN_CATEGORIES.filter((c) => c.id !== "booking");
  const cats = type === "in" ? inCats : MONEY_OUT_CATEGORIES;
  const [category, setCategory] = useState<string>(cats[0].id);
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [method, setMethod] = useState<PayMethod>(type === "out" ? "cash" : "transfer");
  const [note, setNote] = useState("");
  const [bookingId, setBookingId] = useState("");

  const switchType = (t: "in" | "out") => {
    setType(t);
    setCategory((t === "in" ? inCats : MONEY_OUT_CATEGORIES)[0].id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    dispatch({
      type: "addTxn",
      txn: { type, amount: Number(amount), date, category, method, note: note.trim() || undefined, bookingId: bookingId || undefined },
    });
    onDone();
  };

  const recent = [...data.bookings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 grid grid-cols-2 gap-1 p-1 bg-surface-container-high rounded-lg">
        {(["in", "out"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchType(t)}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-label-md font-semibold ${
              type === t ? (t === "in" ? "bg-tertiary-fixed text-on-tertiary-fixed shadow-sm" : "bg-error-container text-on-error-container shadow-sm") : "text-on-surface-variant"
            }`}
          >
            <Icon name={t === "in" ? "south_west" : "north_east"} className="text-base" />
            Money {t}
          </button>
        ))}
      </div>

      <div className="col-span-2">
        <span className="text-label-md font-semibold text-on-surface-variant">Category</span>
        <div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-label-md text-left border transition-colors ${
                category === c.id ? "border-secondary bg-secondary-fixed/50 text-on-secondary-fixed font-semibold" : "border-outline-variant/40 hover:bg-surface-container-low"
              }`}
            >
              <Icon name={c.icon} className="text-base shrink-0" />
              <span className="leading-tight">{c.label}</span>
            </button>
          ))}
        </div>
        {type === "in" && <p className="mt-1.5 text-label-md text-outline">Client payments for bookings: use &quot;Record payment&quot; so the balance updates.</p>}
      </div>

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
          autoFocus
        />
      </Field>
      <Field label="Date">
        <input required type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Paid by / method">
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
          {Object.entries(PAY_METHODS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Related event (optional)">
        <select className={inputClass} value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
          <option value="">—</option>
          {recent.map((b) => (
            <option key={b.id} value={b.id}>
              #{b.code} {b.client}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description" className="col-span-2">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "out" ? "e.g. Petrol Ipoh – KL" : "e.g. Extra prints"} />
      </Field>

      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="check">
          Save
        </Button>
      </div>
    </form>
  );
}
