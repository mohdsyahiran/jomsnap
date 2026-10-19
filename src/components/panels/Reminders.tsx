"use client";

import { useState } from "react";
import { REMINDER_DAYS } from "@/lib/constants";
import { formatTime, parseDate, safeUrl, toISODate } from "@/lib/format";
import { prepReminders, type PrepReminder } from "@/lib/reminders";
import { useStore } from "@/lib/store";
import type { PrepItem } from "@/lib/types";
import { Card, Empty, Icon, PanelHeader, Pill } from "../ui";

export function Reminders() {
  const { data } = useStore();
  const [showDone, setShowDone] = useState(false);
  const reminders = prepReminders(data, toISODate(new Date()));
  const todo = reminders.filter((r) => r.open > 0);
  const ready = reminders.filter((r) => r.open === 0);

  return (
    <div className="space-y-5">
      <PanelHeader
        icon="notifications_active"
        iconClass="bg-secondary-fixed text-on-secondary-fixed"
        title="Prep Reminders"
        subtitle={`From ${REMINDER_DAYS} days before each of your events: get the guestbook printed, finalize the photostrip design and prepare the backdrop. Tick each one off when it's done.`}
      />

      {reminders.length === 0 ? (
        <Card className="p-6">
          <Empty icon="notifications_off">No events in the next {REMINDER_DAYS} days.</Empty>
        </Card>
      ) : (
        <>
          {todo.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed">
              <Icon name="task_alt" className="text-xl" />
              <p className="text-body-sm font-semibold">Everything is ready for the next {REMINDER_DAYS} days.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {todo.map((r) => (
                <ReminderCard key={r.booking.id} r={r} />
              ))}
            </div>
          )}

          {ready.length > 0 && (
            <div>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-label-md font-semibold text-on-surface-variant hover:text-on-surface"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
              >
                <Icon name={showDone ? "expand_less" : "expand_more"} className="text-base" />
                {ready.length} event{ready.length > 1 ? "s" : ""} all set
              </button>
              {showDone && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-3">
                  {ready.map((r) => (
                    <ReminderCard key={r.booking.id} r={r} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReminderCard({ r }: { r: PrepReminder }) {
  const { dispatch } = useStore();
  const b = r.booking;
  const d = parseDate(b.date);
  const design = safeUrl(b.designUrl);
  const when = r.daysLeft === 0 ? "Today" : r.daysLeft === 1 ? "Tomorrow" : `In ${r.daysLeft} days`;
  const detail: Partial<Record<PrepItem, React.ReactNode>> = {
    guestbook: b.guestbook && b.guestbook.status !== "received" && (b.guestbook.status === "ordered" ? "Ordered, not printed yet" : "Not ordered yet"),
    design: design ? (
      <a href={design} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
        Open design
        <Icon name="open_in_new" className="text-xs" />
      </a>
    ) : (
      "No design link yet"
    ),
    backdrop: b.backdrop || "Backdrop not set on the booking",
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex flex-col items-center justify-center shrink-0 shadow-sm">
          <span className="text-label-sm uppercase font-bold text-secondary-fixed">{d.toLocaleDateString("en-MY", { month: "short" })}</span>
          <span className="text-headline-sm font-bold leading-none">{d.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-headline-sm font-bold text-primary">{b.client}</span>
            <span className="text-label-md text-outline">#{b.code}</span>
          </div>
          <p className="text-body-sm text-on-surface-variant truncate">
            {d.toLocaleDateString("en-MY", { weekday: "short" })} · {formatTime(b.startTime)} · {b.venue}
          </p>
        </div>
        <Pill
          className={
            r.open === 0
              ? "bg-tertiary-fixed text-on-tertiary-fixed"
              : r.daysLeft <= 2
                ? "bg-error-container text-on-error-container"
                : "bg-secondary-fixed text-on-secondary-fixed"
          }
        >
          {r.open === 0 ? <Icon name="check" className="text-sm" /> : <Icon name="schedule" className="text-sm" />}
          {when}
        </Pill>
      </div>

      <ul className="mt-4 space-y-2">
        {r.checks.map((c) => (
          <li key={c.item}>
            <label
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${c.done ? "bg-tertiary-fixed/40" : "bg-surface-container-low hover:bg-surface-container"}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 w-5 h-5 accent-[#865225] shrink-0"
                checked={c.done}
                onChange={(e) => {
                  const done = e.target.checked;
                  // Unticking a printed guestbook changes its order status too, so check first
                  if (c.item === "guestbook" && !done && !confirm("Mark the guestbook as not printed yet?")) return;
                  dispatch({ type: "setPrep", id: b.id, item: c.item, done });
                }}
              />
              <span className="min-w-0">
                <span className={`block text-body-md font-semibold ${c.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{c.label}</span>
                {!c.done && detail[c.item] && <span className="block text-label-md text-on-surface-variant mt-0.5">{detail[c.item]}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}
