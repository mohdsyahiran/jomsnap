"use client";

import { useState } from "react";
import { STATUS_STYLE } from "@/lib/constants";
import { formatDate, formatTime, toISODate } from "@/lib/format";
import { exportICS } from "@/lib/ics";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { Button, Card, Empty, Icon, PanelHeader, Pill } from "../ui";

const DOT: Record<Booking["status"], string> = {
  tentative: "bg-error",
  confirmed: "bg-tertiary",
  completed: "bg-outline",
  cancelled: "bg-error",
};

export function Calendar({ onEdit }: { onEdit: (b: Booking) => void }) {
  const { data } = useStore();
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
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="space-y-5">
      <PanelHeader icon="calendar_month" title="Calendar & Reminders" subtitle="See which dates are taken. Export to Google/Apple Calendar with 1-day and 2-hour alarms.">
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
                const isSel = c.iso === selected;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => setSelected(c.iso)}
                    className={`relative aspect-square sm:aspect-auto sm:h-14 flex flex-col items-center justify-center rounded-lg transition-colors ${
                      isSel ? "bg-primary-container text-on-primary" : evs.length ? "bg-surface-container-lowest hover:bg-surface-container-high font-semibold" : "hover:bg-surface-container-high"
                    } ${c.inMonth ? "" : "opacity-30"} ${c.iso === today && !isSel ? "ring-1 ring-secondary" : ""}`}
                  >
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

          <div className="mt-4">
            <p className="text-label-md font-semibold text-on-surface-variant mb-2">{formatDate(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            {dayList.length === 0 ? (
              <p className="text-body-sm text-tertiary flex items-center gap-1.5">
                <Icon name="event_available" className="text-base" />
                Date is free.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayList.map((b) => (
                  <EventRow key={b.id} b={b} onEdit={onEdit} />
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
                <EventRow key={b.id} b={b} onEdit={onEdit} showDate />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EventRow({ b, onEdit, showDate }: { b: Booking; onEdit: (b: Booking) => void; showDate?: boolean }) {
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
      </button>
      <Button variant="soft" className="px-2.5 shrink-0" onClick={() => exportICS([b], `jomsnap-${b.code}.ics`)} title="Add to calendar">
        <Icon name="alarm_add" className="text-base" />
      </Button>
    </li>
  );
}
