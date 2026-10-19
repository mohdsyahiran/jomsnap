"use client";

import { useState } from "react";
import { GUESTBOOK_LEAD_DAYS, PACKAGES, STATUS_STYLE, STATUSES, TEAMS } from "@/lib/constants";
import { toISODate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Booking, BookingStatus, PackageId, Team } from "@/lib/types";
import { Button, Field, Icon, inputClass, Modal } from "./ui";

const EVENT_TYPES: Booking["eventType"][] = ["Wedding", "Engagement", "Corporate", "Birthday", "Other"];
const AREAS: Booking["area"][] = ["Perak", "Kuala Lumpur", "Selangor", "Other"];

// Description | amount | remove button: fixed columns so nothing overflows on phones
const PRICE_ROW = "grid grid-cols-[minmax(0,1fr)_8rem_2.25rem] items-center gap-2";

function MoneyInput({ value, onChange, label, required }: { value: number; onChange: (v: number) => void; label: string; required?: boolean }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label-md text-outline">RM</span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        required={required}
        aria-label={label}
        className={`${inputClass} pl-10 text-right tabular-nums`}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </span>
  );
}

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
    // Old "tentative" bookings must get a real status; no default is picked for them
    status: (booking?.status === "tentative" ? "" : (booking?.status ?? "confirmed")) as BookingStatus | "",
    team: (booking?.team ?? "") as Team | "",
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
    const { guestbook, status, team, ...fields } = f;
    if (!status || !team) return;
    dispatch({
      type: "saveBooking",
      guestbookNeeded: guestbook,
      booking: { ...fields, status, team, id: booking?.id, client: f.client.trim(), venue: f.venue.trim(), price: Number(f.price) || 0, phone: f.phone.trim() || undefined, notes: f.notes.trim() || undefined, backdrop: fields.backdrop.trim() || undefined, designUrl: fields.designUrl.trim() || undefined, extras: fields.extras.filter((x) => x.label.trim() && x.amount > 0).map((x) => ({ label: x.label.trim(), amount: Number(x.amount) })) },
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
      <Field label="Team">
        <select required className={inputClass} value={f.team} onChange={(e) => set("team", e.target.value as Team)}>
          <option value="" disabled>
            Choose team
          </option>
          {TEAMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Status">
        <select required className={inputClass} value={f.status} onChange={(e) => set("status", e.target.value as BookingStatus)}>
          <option value="" disabled>
            Choose status
          </option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_STYLE[st].label}
            </option>
          ))}
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
      <fieldset className="col-span-2 rounded-xl border border-outline-variant/60 px-3 pb-3 pt-1 sm:px-4">
        <legend className="px-1 text-label-md font-semibold text-on-surface-variant">Price</legend>
        <div className="space-y-2">
          <div className={PRICE_ROW}>
            <span className="text-body-sm text-on-surface truncate">{PACKAGES[f.packageId].label.split(" ·")[0]} package</span>
            <MoneyInput required value={f.price} onChange={(v) => set("price", v)} label="Package price" />
            <span />
          </div>
          {f.extras.map((x, i) => (
            <div key={i} className={PRICE_ROW}>
              <input
                className={inputClass}
                value={x.label}
                placeholder="e.g. Transportation"
                aria-label="Extra charge description"
                onChange={(e) => set("extras", f.extras.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))}
              />
              <MoneyInput value={x.amount} onChange={(v) => set("extras", f.extras.map((y, j) => (j === i ? { ...y, amount: v } : y)))} label="Extra charge amount" />
              <button
                type="button"
                aria-label="Remove extra charge"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-outline hover:bg-error-container hover:text-on-error-container"
                onClick={() => set("extras", f.extras.filter((_, j) => j !== i))}
              >
                <Icon name="delete" className="text-lg" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {!f.extras.some((x) => x.label.trim().toLowerCase() === "transportation") && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
              onClick={() => set("extras", [...f.extras, { label: "Transportation", amount: 30 }])}
            >
              <Icon name="add" className="text-base" />
              Transportation
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
            onClick={() => set("extras", [...f.extras, { label: "", amount: 0 }])}
          >
            <Icon name="add" className="text-base" />
            Other charge
          </button>
        </div>
        <div className="mt-3 pt-2 border-t border-outline-variant/50 flex items-center justify-between text-body-md">
          <span className="font-semibold text-on-surface">Total</span>
          <span className="font-bold tabular-nums text-primary">
            RM {(Number(f.price) + f.extras.reduce((sum, x) => sum + (Number(x.amount) || 0), 0)).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </fieldset>
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
