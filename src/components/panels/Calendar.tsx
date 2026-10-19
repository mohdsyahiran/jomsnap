"use client";

import { useState } from "react";
import { STATUS_STYLE } from "@/lib/constants";
import { formatDate, formatTime, parseDate, toISODate } from "@/lib/format";
import { exportICS } from "@/lib/ics";
import { useStore } from "@/lib/store";
import type { Booking, Team, Unavailability } from "@/lib/types";
import { Button, Card, Empty, Field, Icon, inputClass, Modal, PanelHeader, Pill } from "../ui";

const DOT: Record<Booking["status"], string> = {
  tentative: "bg-error",
  confirmed: "bg-tertiary",
  completed: "bg-outline",
  cancelled: "bg-error",
};

/** Every day an entry covers, keyed by YYYY-MM-DD */
export function offDays(entries: Unavailability[]) {
  const map = new Map<string, Unavailability[]>();
  for (const u of entries) {
    const d = parseDate(u.from);
    // Capped at a year so a mistyped range can't hang the page
    for (let i = 0; i < 366 && toISODate(d) <= u.to; i++, d.setDate(d.getDate() + 1)) map.set(toISODate(d), [...(map.get(toISODate(d)) ?? []), u]);
  }
  return map;
}

const rangeLabel = (u: Unavailability) =>
  u.from === u.to
    ? formatDate(u.from, { weekday: "short", day: "numeric", month: "short" })
    : `${formatDate(u.from, { day: "numeric", month: "short" })} – ${formatDate(u.to, { day: "numeric", month: "short" })}`;

export function Calendar({ onEdit }: { onEdit: (b: Booking) => void }) {
  const { data, team, dispatch } = useStore();
  const [marking, setMarking] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const today = toISODate(new Date());
  const [selected, setSelected] = useState<string>(today);

  const first = cursor.getDay();
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => {
    const d = new Date(cursor.getFullYear(), cursor.getMonth(), i - first + 1);
    return { iso: toISODate(d), day: d.getDate(), inMonth: d.getMonth() === cursor.getMonth() };
  });

  const byDate = new Map<string, Booking[]>();
  for (const b of data.bookings) byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);

  const upcoming = data.bookings
    .filter((b) => b.date >= today && b.status !== "cancelled" && b.status !== "completed")
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const dayList = byDate.get(selected) ?? [];
  const off = offDays(data.unavailability);
  const dayOff = off.get(selected) ?? [];
  const isOff = (b: Booking) => !!b.team && (off.get(b.date) ?? []).some((u) => u.team === b.team);
  const upcomingOff = data.unavailability.filter((u) => u.to >= today).sort((a, b) => a.from.localeCompare(b.from));
  // Teams manage their own days off; admin only sees them
  const removeOff = team ? (u: Unavailability) => confirm(`Remove unavailable on ${rangeLabel(u)}?`) && dispatch({ type: "deleteUnavailable", id: u.id }) : undefined;
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="calendar_month"
        title={team ? `Team ${team} schedule` : "Calendar & Reminders"}
        subtitle={
          team
            ? "Your events, and the days your team can't work. Mark days off so admin doesn't book you."
            : "See which dates are taken. Export to Google/Apple Calendar with 1-day and 2-hour alarms."
        }
      >
        {team && (
          <Button icon="event_busy" onClick={() => setMarking(true)}>
            Mark unavailable
          </Button>
        )}
        <Button variant="primary" icon="download" onClick={() => exportICS(upcoming, "jomsnap-upcoming.ics")} disabled={!upcoming.length}>
          Download upcoming .ICS
        </Button>
      </PanelHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-headline-md text-primary flex items-center gap-2">
              <Icon name="date_range" className="text-secondary" />
              {cursor.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="ghost" className="px-2" onClick={() => shift(-1)} aria-label="Previous month">
                <Icon name="chevron_left" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const n = new Date();
                  setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
                  setSelected(today);
                }}
              >
                Today
              </Button>
              <Button variant="ghost" className="px-2" onClick={() => shift(1)} aria-label="Next month">
                <Icon name="chevron_right" />
              </Button>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-xl p-3 sm:p-4">
            <div className="grid grid-cols-7 text-center text-label-sm text-outline mb-2 font-semibold">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 text-center text-label-md">
              {cells.map((c) => {
                const evs = byDate.get(c.iso) ?? [];
                const offs = off.get(c.iso) ?? [];
                const isSel = c.iso === selected;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => setSelected(c.iso)}
                    title={offs.length ? offs.map((u) => `${u.team} unavailable${u.note ? `: ${u.note}` : ""}`).join("\n") : undefined}
                    className={`relative aspect-square sm:aspect-auto sm:h-14 flex flex-col items-center justify-center rounded-lg transition-colors ${
                      isSel
                        ? "bg-primary-container text-on-primary"
                        : offs.length
                          ? "bg-error-container/60 text-on-error-container hover:bg-error-container font-semibold"
                          : evs.length
                            ? "bg-surface-container-lowest hover:bg-surface-container-high font-semibold"
                            : "hover:bg-surface-container-high"
                    } ${c.inMonth ? "" : "opacity-30"} ${c.iso === today && !isSel ? "ring-1 ring-secondary" : ""}`}
                  >
                    {offs.length > 0 && (
                      <span className="absolute top-0.5 inset-x-0 text-[9px] leading-none font-bold uppercase tracking-tight text-error truncate px-0.5">
                        {team ? "Off" : offs.map((u) => u.team).join(" ")}
                      </span>
                    )}
                    {c.day}
                    {evs.length > 0 && (
                      <span className="flex gap-0.5 mt-1">
                        {evs.slice(0, 3).map((b) => (
                          <span key={b.id} className={`w-1.5 h-1.5 rounded-full ${DOT[b.status]}`} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> Event
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-error-container" /> {team ? "Your team is unavailable" : "Team unavailable"}
            </span>
          </p>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-label-md font-semibold text-on-surface-variant">{formatDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              {team && (
                <button type="button" className="text-label-md font-semibold text-secondary hover:underline inline-flex items-center gap-1" onClick={() => setMarking(true)}>
                  <Icon name="event_busy" className="text-base" />
                  Mark unavailable
                </button>
              )}
            </div>
            {dayOff.length > 0 && (
              <ul className="space-y-2 mb-2">
                {dayOff.map((u) => (
                  <OffRow key={u.id} u={u} onRemove={removeOff && (() => removeOff(u))} />
                ))}
              </ul>
            )}
            {dayList.length === 0 ? (
              <p className="text-body-sm text-tertiary flex items-center gap-1.5">
                <Icon name="event_available" className="text-base" />
                Date is free.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayList.map((b) => (
                  <EventRow key={b.id} b={b} onEdit={onEdit} teamOff={isOff(b)} />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-5 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-headline-md text-primary">Upcoming</h3>
            <span className="text-label-md text-secondary font-semibold">{upcoming.length} scheduled</span>
          </div>
          {upcoming.length === 0 ? (
            <Empty icon="event_busy">Nothing scheduled.</Empty>
          ) : (
            <ul className="space-y-2">
              {upcoming.slice(0, 8).map((b) => (
                <EventRow key={b.id} b={b} onEdit={onEdit} showDate teamOff={isOff(b)} />
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between mt-6 mb-3">
            <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
              <Icon name="event_busy" className="text-error" />
              Unavailable
            </h3>
            <span className="text-label-md text-on-surface-variant">{upcomingOff.length} coming up</span>
          </div>
          {upcomingOff.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">{team ? "No days off marked." : "Every team is available."}</p>
          ) : (
            <ul className="space-y-2">
              {upcomingOff.map((u) => (
                <OffRow key={u.id} u={u} showDate onRemove={removeOff && (() => removeOff(u))} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {team && (
        <Modal open={marking} onClose={() => setMarking(false)} title="Mark unavailable">
          {marking && <UnavailableForm day={selected} team={team} onDone={() => setMarking(false)} />}
        </Modal>
      )}
    </div>
  );
}

function OffRow({ u, showDate, onRemove }: { u: Unavailability; showDate?: boolean; onRemove?: () => void }) {
  return (
    <li className="p-3 rounded-xl bg-error-container/50 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className="bg-error-container text-on-error-container">
            <Icon name="event_busy" className="text-sm" />
            {u.team} unavailable
          </Pill>
          {showDate && <span className="text-body-md font-semibold text-primary">{rangeLabel(u)}</span>}
        </div>
        {(u.note || u.by) && (
          <p className="text-label-md text-on-surface-variant mt-0.5 truncate">
            {u.note}
            {u.note && u.by && " · "}
            {u.by && `by ${u.by}`}
          </p>
        )}
      </div>
      {onRemove && (
        <Button variant="ghost" className="px-2.5 shrink-0" onClick={onRemove} title="Remove" aria-label={`Remove unavailable ${rangeLabel(u)}`}>
          <Icon name="delete" className="text-base" />
        </Button>
      )}
    </li>
  );
}

function UnavailableForm({ day, team, onDone }: { day: string; team: Team; onDone: () => void }) {
  const { dispatch } = useStore();
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(day);
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (to < from) return;
    dispatch({ type: "addUnavailable", entry: { team, from, to, note: note.trim() || undefined } });
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="From">
        <input
          required
          type="date"
          className={inputClass}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            if (to < e.target.value) setTo(e.target.value);
          }}
        />
      </Field>
      <Field label="To">
        <input required type="date" min={from} className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <Field label="Reason (optional)" className="col-span-2">
        <input className={inputClass} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Family wedding, crew on leave" />
      </Field>
      <div className="col-span-2 flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" icon="event_busy">
          Mark unavailable
        </Button>
      </div>
    </form>
  );
}

function EventRow({ b, onEdit, showDate, teamOff }: { b: Booking; onEdit: (b: Booking) => void; showDate?: boolean; teamOff?: boolean }) {
  return (
    <li className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between gap-3">
      <button type="button" className="text-left min-w-0" onClick={() => onEdit(b)}>
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className={STATUS_STYLE[b.status].className}>{STATUS_STYLE[b.status].label}</Pill>
          <span className="text-body-md font-semibold text-primary">{b.client}</span>
        </div>
        <p className="text-label-md text-on-surface-variant mt-0.5 truncate">
          {showDate && `${formatDate(b.date, { day: "numeric", month: "short" })} · `}
          {formatTime(b.startTime)} · {b.venue}
          {b.team ? ` · ${b.team}` : " · No team"}
        </p>
        {teamOff && b.status !== "cancelled" && (
          <p className="text-label-md font-semibold text-error mt-0.5 flex items-center gap-1">
            <Icon name="warning" className="text-sm" />
            {b.team} is marked unavailable this day
          </p>
        )}
      </button>
      <Button variant="soft" className="px-2.5 shrink-0" onClick={() => exportICS([b], `jomsnap-${b.code}.ics`)} title="Add to calendar">
        <Icon name="alarm_add" className="text-base" />
      </Button>
    </li>
  );
}
