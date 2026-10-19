"use client";

import Image from "next/image";
import { GUESTBOOK_STYLE, PACKAGES, STATUS_STYLE } from "@/lib/constants";
import { balanceOf, formatDate, formatRM, formatTime, paidOf, parseDate, safeUrl, toISODate, totalOf } from "@/lib/format";
import { exportICS } from "@/lib/ics";
import { stockAlerts, stockLabel } from "@/lib/alerts";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { Button, Card, Icon, PanelHeader, Pill } from "../ui";
import type { TabId } from "../Dashboard";

type Props = { onNewBooking: () => void; onGoto: (t: TabId) => void; onPay: (id: string) => void };

export function Overview({ onNewBooking, onGoto, onPay }: Props) {
  const { data } = useStore();
  const now = new Date();
  const year = now.getFullYear();
  const active = data.bookings.filter((b) => b.status !== "cancelled");
  const thisYear = active.filter((b) => parseDate(b.date).getFullYear() === year);
  const completed = thisYear.filter((b) => b.status === "completed");
  const sum = (xs: Booking[], f: (b: Booking) => number = totalOf) => xs.reduce((s, b) => s + f(b), 0);

  const salesValue = sum(thisYear);
  const collected = sum(thisYear, paidOf);
  const owing = active.filter((b) => balanceOf(b) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const alerts = stockAlerts(data);

  return (
    <div className="space-y-5">
      <PanelHeader icon="query_stats" title="Overview & Sales" subtitle={`Revenue pipeline, balances and stock health for ${year}.`}>
        <Button icon="account_balance_wallet" onClick={() => onGoto("payments")}>
          View balances
        </Button>
        <Button variant="primary" icon="add" onClick={onNewBooking}>
          New booking
        </Button>
      </PanelHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Kpi label="Total sales volume" icon="payments" iconClass="bg-surface-container-high text-secondary">
          <div className="text-headline-xl sm:text-display font-bold text-primary tabular-nums">{formatRM(salesValue)}</div>
          <p className="text-body-sm text-on-surface-variant mt-1">Across {thisYear.length} bookings this year</p>
          <KpiFoot left={`Completed: ${formatRM(sum(completed))}`} right={`${completed.length} event${completed.length === 1 ? "" : "s"} done`} rightClass="text-secondary" />
        </Kpi>
        <Kpi label="Payments received" icon="check_circle" iconClass="bg-tertiary-fixed text-tertiary">
          <div className="text-headline-xl sm:text-display font-bold text-primary tabular-nums">{formatRM(collected)}</div>
          <p className="text-body-sm text-on-surface-variant mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            From this year&apos;s bookings
          </p>
          <KpiFoot left="Of total sales" right={`${salesValue ? Math.round((collected / salesValue) * 100) : 0}% received`} />
        </Kpi>
        <Kpi label="Balances owed" icon="pending_actions" iconClass="bg-secondary-fixed text-secondary">
          <div className="text-headline-xl sm:text-display font-bold text-secondary tabular-nums">{formatRM(sum(owing, balanceOf))}</div>
          <Pill className="mt-1 self-start bg-secondary-fixed text-on-secondary-fixed">{owing.length} bookings with balance</Pill>
          <KpiFoot left="Earliest event due" right={owing[0] ? formatDate(owing[0].date, { weekday: "short", day: "numeric", month: "short" }) : "—"} rightClass="text-error" />
        </Kpi>
        <Kpi
          label="Stock & guestbooks"
          icon={alerts.count ? "warning" : "inventory"}
          iconClass={alerts.count ? "bg-error-container text-error" : "bg-tertiary-fixed text-tertiary"}
        >
          <div className={`text-headline-xl sm:text-display font-bold ${alerts.count ? "text-error" : "text-tertiary"}`}>
            {alerts.count ? `${alerts.count} alert${alerts.count > 1 ? "s" : ""}` : "All good"}
          </div>
          {alerts.count ? (
            <ul className="text-body-sm text-on-surface-variant mt-1 space-y-0.5">
              {alerts.lines.slice(0, 3).map((l) => (
                <li key={l}>{l}</li>
              ))}
              {alerts.count > 3 && <li>+{alerts.count - 3} more</li>}
            </ul>
          ) : (
            <p className="text-body-sm text-on-surface-variant mt-1">Media rolls OK, props ready, guestbooks on track</p>
          )}
          <KpiFoot left={data.stock.map(stockLabel).join(" · ")} right="Open stock →" rightClass="text-secondary cursor-pointer" onRight={() => onGoto("stock")} />
        </Kpi>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <SalesChart bookings={active} now={now} />
        <NextEvent bookings={active} now={now} onPay={onPay} onGoto={onGoto} />
      </div>
    </div>
  );
}

function Kpi({ label, icon, iconClass, children }: { label: string; icon: string; iconClass: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 flex flex-col">
      <div className="flex items-start justify-between mb-5">
        <span className="text-label-md font-medium uppercase tracking-wide text-on-surface">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>
          <Icon name={icon} className="text-lg" />
        </span>
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </Card>
  );
}

function KpiFoot({ left, right, rightClass = "text-on-surface", onRight }: { left: string; right: string; rightClass?: string; onRight?: () => void }) {
  return (
    <div className="mt-auto pt-5 flex items-end justify-between gap-2 text-label-md">
      <span className="text-on-surface-variant">{left}</span>
      {onRight ? (
        <button type="button" onClick={onRight} className={`font-semibold ${rightClass}`}>
          {right}
        </button>
      ) : (
        <span className={`font-semibold text-right ${rightClass}`}>{right}</span>
      )}
    </div>
  );
}

function SalesChart({ bookings, now }: { bookings: Booking[]; now: Date }) {
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 3 + i, 1));
  const series = months.map((m) => {
    const inMonth = bookings.filter((b) => {
      const d = parseDate(b.date);
      return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
    });
    const done = inMonth.filter((b) => b.status === "completed").reduce((s, b) => s + totalOf(b), 0);
    const upcoming = inMonth.filter((b) => b.status !== "completed").reduce((s, b) => s + totalOf(b), 0);
    return { m, done, upcoming, total: done + upcoming, count: inMonth.length };
  });
  const max = Math.max(1, ...series.map((s) => s.total));
  const peak = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]);
  const windowTotal = series.reduce((s, x) => s + x.total, 0);

  return (
    <Card className="lg:col-span-8 p-6 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="text-headline-md text-primary flex items-center gap-2">
            <Icon name="bar_chart" className="text-secondary" filled />
            Monthly Sales & Pipeline
          </h3>
          <p className="text-body-sm text-on-surface-variant">Completed events vs confirmed events still to come, by event month.</p>
        </div>
        <div className="flex items-center gap-4 text-label-md">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary-container" />
            Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-secondary-fixed" />
            Confirmed (upcoming)
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-56 grid grid-cols-6 gap-3 sm:gap-6 items-end px-1">
        {series.map((s) => {
          const isPeak = s === peak && s.total > 0;
          return (
            <div key={s.m.toISOString()} className="flex flex-col items-center gap-2 h-full justify-end group">
              <span className="text-label-sm text-on-surface-variant tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{formatRM(s.total)}</span>
              <div
                className={`w-full max-w-14 flex flex-col justify-end rounded-t-md overflow-hidden ${isPeak ? "ring-2 ring-secondary-container" : ""}`}
                style={{ height: `${Math.max(2, (s.total / max) * 100)}%` }}
                title={`${s.count} bookings · ${formatRM(s.done)} completed · ${formatRM(s.upcoming)} confirmed`}
              >
                <div className="bg-secondary-fixed" style={{ flexGrow: s.upcoming || 0.0001 }} />
                <div className="bg-primary-container" style={{ flexGrow: s.done || (s.total ? 0.0001 : 1) }} />
              </div>
              <span className={`text-label-md ${isPeak ? "text-secondary font-semibold" : "text-on-surface"}`}>
                {s.m.toLocaleDateString("en-MY", { month: "short" })}
                {isPeak && " (Peak)"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-4 py-3 text-body-sm">
        <span className="flex items-center gap-2">
          <Icon name="trending_up" className="text-base" />
          6-month window total: <strong className="tabular-nums">{formatRM(windowTotal)}</strong>
        </span>
      </div>
    </Card>
  );
}

function NextEvent({ bookings, now, onPay, onGoto }: { bookings: Booking[]; now: Date; onPay: (id: string) => void; onGoto: (t: TabId) => void }) {
  const today = toISODate(now);
  const next = bookings.filter((b) => b.date >= today && b.status !== "completed").sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];

  return (
    <Card className="lg:col-span-4 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-label-md uppercase tracking-wide text-secondary font-semibold">Next event</span>
        {next && <Pill className={STATUS_STYLE[next.status].className}>{STATUS_STYLE[next.status].label}</Pill>}
      </div>
      {!next ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-on-surface-variant text-body-sm py-10">
          <Icon name="event_busy" className="text-3xl text-outline" />
          No upcoming events.
        </div>
      ) : (
        <>
          <h3 className="text-headline-md font-bold text-primary">{next.client}</h3>
          <p className="text-body-sm text-on-surface-variant">
            #{next.code} · {next.eventType} · {PACKAGES[next.packageId].label}
          </p>

          <div className="relative mt-4 rounded-xl overflow-hidden bg-[#F5E0C0] h-36 flex items-center justify-center">
            <Image src="/logo.png" alt="JomSnap" width={220} height={184} className="h-28 w-auto object-contain" />
            <span className="absolute bottom-2 left-3 text-label-md font-semibold text-primary/80">
              {formatDate(next.date, { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>

          <dl className="mt-4 space-y-2 text-body-sm">
            <Row icon="schedule" label={`${formatTime(next.startTime)} – ${formatTime(next.endTime)}`} />
            <Row icon="location_on" label={`${next.venue} · ${next.area}`} />
            <Row icon="groups" label={next.team ? `Team ${next.team}` : "No team assigned yet"} className={next.team ? "" : "text-error"} />
            {next.backdrop && <Row icon="wallpaper" label={`Backdrop: ${next.backdrop}`} />}
            {safeUrl(next.designUrl) && (
              <div className="flex items-start gap-2">
                <Icon name="palette" className="text-base text-on-surface-variant mt-0.5" />
                <a href={safeUrl(next.designUrl)} target="_blank" rel="noopener noreferrer" className="font-semibold text-secondary hover:underline">
                  Open design (Canva)
                </a>
              </div>
            )}
            {next.guestbook && <Row icon="menu_book" label={GUESTBOOK_STYLE[next.guestbook.status].label} />}
            <Row
              icon="verified"
              label={balanceOf(next) > 0 ? `Balance ${formatRM(balanceOf(next))} of ${formatRM(totalOf(next))}` : `Paid in full (${formatRM(totalOf(next))})`}
              className={balanceOf(next) > 0 ? "text-secondary" : "text-tertiary"}
            />
          </dl>

          <div className="mt-auto pt-5 grid grid-cols-2 gap-2">
            {balanceOf(next) > 0 ? (
              <Button icon="add_card" onClick={() => onPay(next.id)}>
                Payment
              </Button>
            ) : (
              <Button icon="alarm" onClick={() => exportICS([next], `jomsnap-${next.code}.ics`)}>
                Reminder
              </Button>
            )}
            <a
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-label-md font-semibold bg-surface-container-high hover:bg-surface-container-highest"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.venue)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="near_me" className="text-base" />
              Navigate
            </a>
            <button type="button" className="col-span-2 text-label-md text-secondary font-semibold pt-1" onClick={() => onGoto("bookings")}>
              All bookings →
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function Row({ icon, label, className = "" }: { icon: string; label: string; className?: string }) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <Icon name={icon} className="text-base text-on-surface-variant mt-0.5" />
      <span>{label}</span>
    </div>
  );
}
