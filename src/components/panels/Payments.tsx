"use client";

import { useState } from "react";
import { STATUS_STYLE } from "@/lib/constants";
import { balanceOf, formatDate, formatRM, formatRM2, paidOf, totalOf } from "@/lib/format";
import { canInvoice } from "@/lib/invoice";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { Button, Card, Empty, Icon, PanelHeader, Pill } from "../ui";

export function Payments({ onPay, onInvoice }: { onPay: (id: string | null) => void; onInvoice: (b: Booking) => void }) {
  const { data } = useStore();
  const [onlyOwing, setOnlyOwing] = useState(true);
  const active = data.bookings.filter((b) => b.status !== "cancelled");
  const rows = active.filter((b) => !onlyOwing || balanceOf(b) > 0).sort((a, b) => a.date.localeCompare(b.date));

  const totalPrice = active.reduce((s, b) => s + totalOf(b), 0);
  const totalPaid = active.reduce((s, b) => s + paidOf(b), 0);
  const totalOwed = active.reduce((s, b) => s + balanceOf(b), 0);
  const owingCount = active.filter((b) => balanceOf(b) > 0).length;

  return (
    <div className="space-y-5">
      <PanelHeader icon="account_balance_wallet" title="Payments & Balances" subtitle="Package prices, deposits received and what clients still owe.">
        <Button variant="primary" icon="add_card" onClick={() => onPay(null)}>
          Record payment
        </Button>
      </PanelHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Stat label="Total booked" value={formatRM(totalPrice)} />
        <Stat label="Received" value={formatRM(totalPaid)} className="text-tertiary" />
        <Stat label="Outstanding" value={formatRM(totalOwed)} className="text-secondary" />
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <span className="text-label-md font-semibold text-on-surface">Client ledger</span>
            <p className="text-body-sm text-on-surface-variant">Tap a row&apos;s button to record a deposit or balance payment.</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-container-high rounded-lg">
            {[
              [true, `Owing (${owingCount})`],
              [false, `All (${active.length})`],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setOnlyOwing(v as boolean)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-semibold ${onlyOwing === v ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty icon="price_check">All balances settled.</Empty>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[640px] text-left text-body-sm">
              <thead>
                <tr className="bg-surface-container-low text-outline text-label-sm uppercase">
                  <th className="p-3 rounded-l-lg">Client & event</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-center rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const bal = balanceOf(b);
                  return (
                    <tr key={b.id} className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-low/60">
                      <td className="p-3">
                        <div className="font-medium text-on-surface flex items-center gap-2">
                          {b.client}
                          <Pill className={STATUS_STYLE[b.status].className}>{STATUS_STYLE[b.status].label}</Pill>
                        </div>
                        <div className="text-label-md text-outline">
                          #{b.code} · {formatDate(b.date)} · {b.payments.length} payment{b.payments.length === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td className="p-3 text-right tabular-nums">{formatRM2(totalOf(b))}</td>
                      <td className="p-3 text-right tabular-nums text-tertiary">{formatRM2(paidOf(b))}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">
                        {bal > 0 ? (
                          <span className="text-secondary">{formatRM2(bal)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-tertiary">
                            <Icon name="check_circle" className="text-sm" />
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex gap-1.5">
                          <Button variant={bal > 0 ? "primary" : "soft"} className="px-3 py-1.5" onClick={() => onPay(b.id)}>
                            {bal > 0 ? "Record" : "History"}
                          </Button>
                          {canInvoice(b) && (
                            <Button className="px-3 py-1.5" icon="receipt_long" onClick={() => onInvoice(b)}>
                              {b.invoiceNo ?? "Invoice"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, className = "text-primary" }: { label: string; value: string; className?: string }) {
  return (
    <Card className="p-5">
      <span className="text-label-md uppercase tracking-wide text-on-surface-variant">{label}</span>
      <div className={`text-headline-xl font-bold tabular-nums mt-1 ${className}`}>{value}</div>
    </Card>
  );
}
