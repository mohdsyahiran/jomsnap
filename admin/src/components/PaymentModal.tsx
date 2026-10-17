"use client";

import { useState } from "react";
import { balanceOf, formatDate, formatRM2, paidOf, toISODate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Payment } from "@/lib/types";
import { Button, Field, Icon, inputClass, Modal } from "./ui";

const METHODS: Record<Payment["method"], string> = { transfer: "Bank transfer", duitnow: "DuitNow QR", cash: "Cash", other: "Other" };

export function PaymentModal({ bookingId, open, onClose }: { bookingId: string | null; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      {open && <PaymentForm key={bookingId ?? "pick"} initialId={bookingId} onDone={onClose} />}
    </Modal>
  );
}

function PaymentForm({ initialId, onDone }: { initialId: string | null; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const payable = data.bookings.filter((b) => b.status !== "cancelled").sort((a, b) => balanceOf(b) - balanceOf(a));
  const [bookingId, setBookingId] = useState(initialId ?? payable[0]?.id ?? "");
  const booking = data.bookings.find((b) => b.id === bookingId);
  const [amount, setAmount] = useState(() => (booking ? balanceOf(booking) : 0));
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [method, setMethod] = useState<Payment["method"]>("transfer");
  const [note, setNote] = useState("");

  if (!payable.length) return <p className="text-body-sm text-on-surface-variant">Create a booking first.</p>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking || amount <= 0) return;
    dispatch({ type: "addPayment", bookingId: booking.id, payment: { amount, date, method, note: note.trim() || undefined } });
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Booking" className="col-span-2">
        <select
          className={inputClass}
          value={bookingId}
          onChange={(e) => {
            setBookingId(e.target.value);
            const b = data.bookings.find((x) => x.id === e.target.value);
            setAmount(b ? balanceOf(b) : 0);
          }}
        >
          {payable.map((b) => (
            <option key={b.id} value={b.id}>
              #{b.code} {b.client} — balance {formatRM2(balanceOf(b))}
            </option>
          ))}
        </select>
      </Field>

      {booking && (
        <div className="col-span-2 rounded-xl bg-surface-container-low p-3 text-body-sm">
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Package price</span>
            <span className="tabular-nums">{formatRM2(booking.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Paid so far</span>
            <span className="tabular-nums text-tertiary">{formatRM2(paidOf(booking))}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Balance</span>
            <span className="tabular-nums text-secondary">{formatRM2(balanceOf(booking))}</span>
          </div>
          {booking.payments.length > 0 && (
            <ul className="mt-2 pt-2 border-t border-outline-variant/40 space-y-1">
              {booking.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-label-md">
                  <span className="text-on-surface-variant">
                    {formatDate(p.date)} · {METHODS[p.method]}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {formatRM2(p.amount)}
                    <button
                      type="button"
                      aria-label="Remove payment"
                      className="p-0.5 rounded hover:bg-error-container text-outline hover:text-on-error-container"
                      onClick={() => confirm(`Remove payment of ${formatRM2(p.amount)}?`) && dispatch({ type: "deletePayment", bookingId: booking.id, paymentId: p.id })}
                    >
                      <Icon name="delete" className="text-sm" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Field label="Amount (RM)">
        <input required type="number" min={1} step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </Field>
      <Field label="Date received">
        <input required type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Method">
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as Payment["method"])}>
          {Object.entries(METHODS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Deposit / balance" />
      </Field>
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="add_card">
          Record payment
        </Button>
      </div>
    </form>
  );
}
