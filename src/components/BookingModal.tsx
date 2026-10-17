"use client";

import { useState } from "react";
import { PACKAGES } from "@/lib/constants";
import { toISODate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Booking, PackageId } from "@/lib/types";
import { Button, Field, inputClass, Modal } from "./ui";

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
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const pickPackage = (id: PackageId) => {
    const p = PACKAGES[id];
    setF((prev) => ({
      ...prev,
      packageId: id,
      price: id === "custom" ? prev.price : p.price,
      endTime: id === "custom" ? prev.endTime : addHours(prev.startTime, p.hours),
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({
      type: "saveBooking",
      booking: { ...f, id: booking?.id, client: f.client.trim(), venue: f.venue.trim(), price: Number(f.price) || 0, phone: f.phone.trim() || undefined, notes: f.notes.trim() || undefined },
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
