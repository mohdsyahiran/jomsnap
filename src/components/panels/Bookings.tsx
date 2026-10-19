"use client";

import { useState } from "react";
import { GUESTBOOK_STYLE, PACKAGES, STATUS_STYLE, TEAMS } from "@/lib/constants";
import { balanceOf, formatRM, formatTime, parseDate, safeUrl, toISODate, totalOf, whatsappLink } from "@/lib/format";
import { exportICS } from "@/lib/ics";
import { canInvoice } from "@/lib/invoice";
import { useStore } from "@/lib/store";
import type { Booking, BookingStatus, Team } from "@/lib/types";
import { Button, Card, Empty, Icon, inputClass, PanelHeader, Pill } from "../ui";

type Filter = "upcoming" | "all" | BookingStatus;
type TeamFilter = "all" | "none" | Team;

export function Bookings({ onNew, onEdit, onSetup, onPay, onInvoice }: { onNew: () => void; onEdit: (b: Booking) => void; onSetup: (b: Booking) => void; onPay: (id: string) => void; onInvoice: (b: Booking) => void }) {
  const { data, dispatch } = useStore();
  const [chosenFilter, setFilter] = useState<Filter>("upcoming");
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<TeamFilter>("all");
  const today = toISODate(new Date());

  const matches = (b: Booking, f: Filter) =>
    f === "all" ? true : f === "upcoming" ? b.date >= today && b.status !== "cancelled" && b.status !== "completed" : b.status === f;
  const count = (f: Filter) => data.bookings.filter((b) => matches(b, f)).length;
  // The "Needs status" chip disappears once every old booking has a status; don't leave it selected
  const filter: Filter = chosenFilter === "tentative" && !count("tentative") ? "upcoming" : chosenFilter;

  const needle = q.trim().toLowerCase();
  const teamMatches = (b: Booking) => team === "all" || (team === "none" ? !b.team : b.team === team);
  const noTeam = data.bookings.filter((b) => !b.team && b.status !== "cancelled").length;
  const rows = data.bookings
    .filter((b) => matches(b, filter))
    .filter(teamMatches)
    .filter((b) => !needle || `${b.client} ${b.venue} ${b.code} ${b.phone ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => (filter === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const filters: [Filter, string][] = [
    ["upcoming", "Upcoming"],
    // Old bookings from before "Tentative" was removed, until someone picks a status
    ...(count("tentative") ? ([["tentative", "Needs status"]] as [Filter, string][]) : []),
    ["confirmed", "Confirmed"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
    ["all", "All"],
  ];

  const remove = (b: Booking) => {
    const msg = `Delete booking #${b.code} for "${b.client}"?${b.suppliesDeducted ? "\n\nSupplies used for this booking will be returned to stock." : ""}`;
    if (confirm(msg)) dispatch({ type: "deleteBooking", id: b.id });
  };

  return (
    <div className="space-y-5">
      <PanelHeader icon="event_available" iconClass="bg-primary-container text-on-primary" title="Booking Register" subtitle="All reservations, packages and client contacts.">
        <Button icon="calendar_month" onClick={() => exportICS(rows, "jomsnap-bookings.ics")} disabled={!rows.length}>
          Export .ICS
        </Button>
        <Button variant="primary" icon="add" onClick={onNew}>
          New booking
        </Button>
      </PanelHeader>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-1 p-1 bg-surface-container-high rounded-lg overflow-x-auto no-scrollbar">
            {filters.map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-semibold whitespace-nowrap transition-all ${
                  filter === f ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {label} ({count(f)})
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface-container-high rounded-lg overflow-x-auto no-scrollbar" role="group" aria-label="Team">
            {(["all", ...TEAMS, ...(noTeam ? (["none"] as const) : [])] as TeamFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTeam(t)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-semibold whitespace-nowrap transition-all ${
                  team === t ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t === "all" ? "All teams" : t === "none" ? `No team (${noTeam})` : t}
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-outline" />
            <input className={`${inputClass} pl-9`} placeholder="Search client, venue, #code" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty icon="event_note">No bookings here.</Empty>
        ) : (
          <div className="space-y-3">
            {rows.map((b) => {
              const d = parseDate(b.date);
              const bal = balanceOf(b);
              const wa = whatsappLink(b.phone);
              const design = safeUrl(b.designUrl);
              return (
                <div key={b.id} className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex flex-col items-center justify-center shrink-0 shadow-sm">
                      <span className="text-label-sm uppercase font-bold text-secondary-fixed">{d.toLocaleDateString("en-MY", { month: "short" })}</span>
                      <span className="text-headline-sm font-bold leading-none">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-headline-sm font-bold text-primary">{b.client}</span>
                        <Pill className={STATUS_STYLE[b.status].className}>{STATUS_STYLE[b.status].label}</Pill>
                        {b.team ? (
                          <Pill className="bg-primary-container text-on-primary">
                            <Icon name="groups" className="text-sm" />
                            {b.team}
                          </Pill>
                        ) : (
                          b.status !== "cancelled" && <Pill className="bg-error-container text-on-error-container">No team</Pill>
                        )}
                        {b.guestbook && b.status !== "cancelled" && <Pill className={GUESTBOOK_STYLE[b.guestbook.status].className}>{GUESTBOOK_STYLE[b.guestbook.status].label}</Pill>}
                        <span className="text-label-md text-outline">#{b.code}</span>
                      </div>
                      <p className="text-body-sm text-on-surface-variant truncate">
                        {d.toLocaleDateString("en-MY", { weekday: "short" })} · {formatTime(b.startTime)}–{formatTime(b.endTime)} · {b.venue}, {b.area}
                      </p>
                      <p className="text-label-md text-outline mt-0.5">
                        {b.eventType} · {PACKAGES[b.packageId].label} · {formatRM(totalOf(b))}
                        {b.extras?.length ? ` (incl. ${b.extras.map((e) => e.label).join(", ")})` : ""}
                        {bal > 0 && <span className="text-secondary font-semibold"> · balance {formatRM(bal)}</span>}
                        {b.suppliesDeducted && <span className="text-tertiary"> · supplies recorded</span>}
                      </p>
                      {(b.backdrop || design) && (
                        <p className="text-label-md text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {b.backdrop && (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="wallpaper" className="text-sm" />
                              {b.backdrop}
                            </span>
                          )}
                          {design && (
                            <a href={design} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-secondary hover:underline">
                              <Icon name="palette" className="text-sm" />
                              Open design
                              <Icon name="open_in_new" className="text-xs" />
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 xl:justify-end shrink-0">
                    {(b.status === "tentative" || !b.team) && (
                      <Button icon="edit_note" className="bg-error-container text-on-error-container hover:bg-error-container" onClick={() => onSetup(b)}>
                        {b.status === "tentative" && !b.team ? "Set status & team" : b.status === "tentative" ? "Set status" : "Set team"}
                      </Button>
                    )}
                    {b.status === "confirmed" && b.date <= today && (
                      <Button icon="task_alt" onClick={() => dispatch({ type: "setStatus", id: b.id, status: "completed" })}>
                        Mark done
                      </Button>
                    )}
                    {bal > 0 && b.status !== "cancelled" && (
                      <Button icon="add_card" onClick={() => onPay(b.id)}>
                        Payment
                      </Button>
                    )}
                    {canInvoice(b) && (
                      <Button icon="receipt_long" onClick={() => onInvoice(b)}>
                        {b.invoiceNo ? "Invoice" : "Create invoice"}
                      </Button>
                    )}
                    {wa && <IconBtn icon="chat" label="WhatsApp client" href={wa} />}
                    <IconBtn icon="event" label="Add to calendar (.ics)" onClick={() => exportICS([b], `jomsnap-${b.code}.ics`)} />
                    <IconBtn icon="edit" label="Edit" onClick={() => onEdit(b)} />
                    <IconBtn icon="delete" label="Delete" danger onClick={() => remove(b)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function IconBtn({ icon, label, onClick, href, danger }: { icon: string; label: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `w-9 h-9 inline-flex items-center justify-center rounded-lg transition-colors ${
    danger ? "text-outline hover:bg-error-container hover:text-on-error-container" : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
  }`;
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} title={label} aria-label={label}>
        <Icon name={icon} className="text-lg" />
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls} title={label} aria-label={label}>
      <Icon name={icon} className="text-lg" />
    </button>
  );
}
