"use client";

import { useState } from "react";
import { GUESTBOOK_LEAD_DAYS, PACKAGES } from "@/lib/constants";
import { toISODate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Booking, PackageId } from "@/lib/types";
import { Button, Field, Icon, inputClass, Modal } from "./ui";

const EVENT_TYPES: Booking["eventType"][] = ["Wedding", "Engagement", "Corporate", "Birthday", "Other"];
const AREAS: Booking["area"][] = ["Perak", "Kuala Lumpur", "Selangor", "Other"];

function addHours(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  return `${String(Math.min(23, h + hours)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function BookingModal({ booking, open, onClose }: { booking: Booking | null; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={booking ? `Edit booking #${booking.code}` : "New booking"}>
      {/* key resets the form state whenever a different booking is opened */}
      {open && <BookingForm key={booking?.id ?? "new"} booking={booking} onDone={onClose} />}
    </Modal>
  );
}

function BookingForm({ booking, onDone }: { booking: Booking | null; onDone: () => void }) {
  const { dispatch } = useStore();
  const [f, setF] = useState(() => ({
    client: booking?.client ?? "",
    phone: booking?.phone ?? "",
    eventType: booking?.eventType ?? "Wedding",
    date: booking?.date ?? toISODate(new Date()),
    startTime: booking?.startTime ?? "12:00",
    endTime: booking?.endTime ?? "15:00",
    venue: booking?.venue ?? "",
    area: booking?.area ?? "Perak",
    packageId: booking?.packageId ?? ("standard" as PackageId),
    price: booking?.price ?? PACKAGES.standard.price,
    status: booking?.status ?? "tentative",
    notes: booking?.notes ?? "",
    backdrop: booking?.backdrop ?? "",
    extras: booking?.extras ?? [],
    designUrl: booking?.designUrl ?? "",
    guestbook: booking ? !!booking.guestbook : PACKAGES.standard.guestbook,
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const pickPackage = (id: PackageId) => {
    const p = PACKAGES[id];
    setF((prev) => ({
      ...prev,
      packageId: id,
      guestbook: id === "custom" ? prev.guestbook : p.guestbook,
      price: id === "custom" ? prev.price : p.price,
      endTime: id === "custom" ? prev.endTime : addHours(prev.startTime, p.hours),
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { guestbook, ...fields } = f;
    dispatch({
      type: "saveBooking",
      guestbookNeeded: guestbook,
      booking: { ...fields, id: booking?.id, client: f.client.trim(), venue: f.venue.trim(), price: Number(f.price) || 0, phone: f.phone.trim() || undefined, notes: f.notes.trim() || undefined, backdrop: fields.backdrop.trim() || undefined, designUrl: fields.designUrl.trim() || undefined, extras: fields.extras.filter((x) => x.label.trim() && x.amount > 0).map((x) => ({ label: x.label.trim(), amount: Number(x.amount) })) },
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Client / couple name" className="col-span-2">
        <input required className={inputClass} value={f.client} onChange={(e) => set("client", e.target.value)} placeholder="e.g. Aisyah & Hakim" />
      </Field>
      <Field label="Phone (WhatsApp)">
        <input className={inputClass} value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="012-345 6789" inputMode="tel" />
      </Field>
      <Field label="Event type">
        <select className={inputClass} value={f.eventType} onChange={(e) => set("eventType", e.target.value as Booking["eventType"])}>
          {EVENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Date" className="col-span-2 sm:col-span-1">
        <input required type="date" className={inputClass} value={f.date} onChange={(e) => set("date", e.target.value)} />
      </Field>
      <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-2">
        <Field label="Start">
          <input required type="time" className={inputClass} value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </Field>
        <Field label="End">
          <input required type="time" className={inputClass} value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
        </Field>
      </div>
      <Field label="Venue" className="col-span-2">
        <input required className={inputClass} value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Dewan / hotel / address" />
      </Field>
      <Field label="Area">
        <select className={inputClass} value={f.area} onChange={(e) => set("area", e.target.value as Booking["area"])}>
          {AREAS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select className={inputClass} value={f.status} onChange={(e) => set("status", e.target.value as Booking["status"])}>
          <option value="tentative">Tentative</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Field>
      <Field label="Package">
        <select className={inputClass} value={f.packageId} onChange={(e) => pickPackage(e.target.value as PackageId)}>
          {(Object.keys(PACKAGES) as PackageId[]).map((id) => (
            <option key={id} value={id}>
              {PACKAGES[id].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Price (RM)">
        <input required type="number" min={0} step="1" className={inputClass} value={f.price} onChange={(e) => set("price", Number(e.target.value))} />
      </Field>
      <div className="col-span-2 rounded-lg bg-surface-container-low p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-label-md font-semibold text-on-surface-variant">Extra charges</span>
          <span className="text-label-md text-on-surface-variant">
            Total <strong className="text-on-surface tabular-nums">RM {(Number(f.price) + f.extras.reduce((s, x) => s + (Number(x.amount) || 0), 0)).toLocaleString("en-MY")}</strong>
          </span>
        </div>
        <div className="space-y-2">
          {f.extras.map((x, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputClass}
                value={x.label}
                placeholder="e.g. Transportation"
                aria-label="Extra charge description"
                onChange={(e) => set("extras", f.extras.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className={`${inputClass} w-32 shrink-0`}
                value={x.amount || ""}
                placeholder="RM"
                aria-label="Extra charge amount"
                onChange={(e) => set("extras", f.extras.map((y, j) => (j === i ? { ...y, amount: Number(e.target.value) } : y)))}
              />
              <button
                type="button"
                aria-label="Remove extra charge"
                className="w-10 shrink-0 rounded-lg text-outline hover:bg-error-container hover:text-on-error-container"
                onClick={() => set("extras", f.extras.filter((_, j) => j !== i))}
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {!f.extras.some((x) => x.label === "Transportation") && (
            <Button className="px-3 py-1.5" icon="local_shipping" onClick={() => set("extras", [...f.extras, { label: "Transportation", amount: 30 }])}>
              Transportation
            </Button>
          )}
          <Button className="px-3 py-1.5" icon="add" onClick={() => set("extras", [...f.extras, { label: "", amount: 0 }])}>
            Other charge
          </Button>
        </div>
      </div>
      <Field label="Backdrop">
        <input className={inputClass} value={f.backdrop} onChange={(e) => set("backdrop", e.target.value)} placeholder="e.g. Floral white" />
      </Field>
      <Field label="Design (Canva link)">
        <input
          type="url"
          className={inputClass}
          value={f.designUrl}
          onChange={(e) => set("designUrl", e.target.value)}
          placeholder="https://www.canva.com/design/…"
          pattern="https?://.+"
          title="Paste the full link, starting with https://"
        />
      </Field>
      <label className="col-span-2 flex items-start gap-2.5 p-3 rounded-lg bg-surface-container-low cursor-pointer">
        <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#865225]" checked={f.guestbook} onChange={(e) => set("guestbook", e.target.checked)} />
        <span className="text-body-sm">
          <span className="font-semibold text-on-surface">Includes guestbook</span>
          <span className="block text-on-surface-variant">Needs to be ordered at least {GUESTBOOK_LEAD_DAYS} days before the event. You&apos;ll get a reminder.</span>
        </span>
      </label>
      <Field label="Notes" className="col-span-2">
        <textarea rows={2} className={inputClass} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Backdrop colour, add-ons, transport…" />
      </Field>
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="check">
          {booking ? "Save changes" : "Create booking"}
        </Button>
      </div>
    </form>
  );
}
