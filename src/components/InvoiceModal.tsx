"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatRM2 } from "@/lib/format";
import { invoiceLines, nextInvoiceNo, paymentStatus, totalOf } from "@/lib/invoice";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { Button, Field, inputClass, Modal, Pill } from "./ui";

export function InvoiceModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  return (
    <Modal open={!!booking} onClose={onClose} title={booking?.invoiceNo ? `Invoice ${booking.invoiceNo}` : "Create invoice"}>
      {booking && <InvoiceForm key={booking.id} booking={booking} onDone={onClose} />}
    </Modal>
  );
}

function InvoiceForm({ booking: b, onDone }: { booking: Booking; onDone: () => void }) {
  const { data, dispatch } = useStore();
  const router = useRouter();
  const [no, setNo] = useState(() => b.invoiceNo ?? nextInvoiceNo(data, new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const taken = data.bookings.some((x) => x.id !== b.id && x.invoiceNo === no.trim());
  const status = paymentStatus(b);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taken) return;
    setBusy(true);
    const ok = no.trim() === b.invoiceNo || (await dispatch({ type: "issueInvoice", id: b.id, invoiceNo: no.trim() }));
    setBusy(false);
    if (ok) {
      onDone();
      router.push(`/admin/invoice/${b.id}`);
    }
  };

  return (
    <form onSubmit={open} className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface-container-low p-3 text-body-sm space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-on-surface">
            #{b.code} {b.client}
          </span>
          <Pill className={status === "PAID" ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-secondary-fixed text-on-secondary-fixed"}>{status}</Pill>
        </div>
        <p className="text-on-surface-variant">
          {formatDate(b.date)} · {b.venue}
        </p>
        <ul className="pt-2 mt-2 border-t border-outline-variant/40 space-y-0.5">
          {invoiceLines(b).map((l, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{l.description}</span>
              <span className="tabular-nums">{l.price === "included" ? "Included" : formatRM2(l.total)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-2 font-semibold pt-1">
            <span>Total</span>
            <span className="tabular-nums">{formatRM2(totalOf(b))}</span>
          </li>
        </ul>
      </div>

      <Field label="Invoice number">
        <input required className={inputClass} value={no} onChange={(e) => setNo(e.target.value)} pattern={"[A-Za-z0-9\\/\\-]{1,30}"} />
      </Field>
      {taken ? (
        <p className="text-body-sm text-error">This number is already used on another booking.</p>
      ) : (
        <p className="text-label-md text-outline">
          {b.invoiceNo ? "Changing the number keeps the original invoice date." : "Numbers follow JS-YEAR-001, 002… Change it if you've issued invoices by hand before."}
        </p>
      )}
      <p className="text-label-md text-outline">Wrong item or price? Edit the booking (package, price or extra charges) first.</p>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="receipt_long" disabled={busy || taken}>
          {busy ? "Saving…" : b.invoiceNo ? "Open invoice" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
