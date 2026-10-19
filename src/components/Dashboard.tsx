"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { balanceOf, formatRMShort, timeAgo, toISODate } from "@/lib/format";
import { stockAlerts } from "@/lib/alerts";
import { prepReminders } from "@/lib/reminders";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { logout } from "@/app/actions";
import { BookingDetails } from "./BookingDetails";
import { BookingModal, SetupModal } from "./BookingModal";
import { InvoiceModal } from "./InvoiceModal";
import { MoneyModal } from "./MoneyModal";
import { PaymentModal } from "./PaymentModal";
import { Backup } from "./panels/Backup";
import { Bookings } from "./panels/Bookings";
import { Calendar } from "./panels/Calendar";
import { Money } from "./panels/Money";
import { Overview } from "./panels/Overview";
import { Payments } from "./panels/Payments";
import { Reminders } from "./panels/Reminders";
import { Stock } from "./panels/Stock";
import { Button, Icon } from "./ui";

export type TabId = "overview" | "bookings" | "money" | "calendar" | "reminders" | "payments" | "stock" | "backup";

const TABS: { id: TabId; label: string; short: string; icon: string }[] = [
  { id: "overview", label: "Overview & Sales", short: "Overview", icon: "dashboard" },
  { id: "bookings", label: "Bookings", short: "Bookings", icon: "event_note" },
  { id: "money", label: "Money In & Out", short: "Money", icon: "account_balance" },
  { id: "calendar", label: "Calendar & Reminders", short: "Calendar", icon: "calendar_month" },
  { id: "payments", label: "Payments & Balances", short: "Payments", icon: "payments" },
  { id: "stock", label: "Stock", short: "Stock", icon: "inventory_2" },
  { id: "backup", label: "Backup & Data", short: "Backup", icon: "cloud_sync" },
];

// Team logins only get their schedule, event prep and stock
const TEAM_TABS: typeof TABS = [
  { id: "calendar", label: "Schedule", short: "Schedule", icon: "calendar_month" },
  { id: "reminders", label: "Prep Reminders", short: "Reminders", icon: "notifications_active" },
  { id: "stock", label: "Stock", short: "Stock", icon: "inventory_2" },
];

// Mobile bottom bar shows these; the rest sit under "More"
const MOBILE_MAIN: TabId[] = ["overview", "bookings", "money", "calendar"];

export function Dashboard({ user }: { user: string }) {
  const { data, savedAt, status, team } = useStore();
  const tabs = team ? TEAM_TABS : TABS;
  // A team's few tabs all fit in the mobile bar
  const mobileMain = team ? tabs.map((t) => t.id) : MOBILE_MAIN;
  const [moneyModal, setMoneyModal] = useState<{ open: boolean; type: "in" | "out" }>({ open: false, type: "out" });
  const [moreOpen, setMoreOpen] = useState(false);
  const [invoiceFor, setInvoiceFor] = useState<Booking | null>(null);
  const [tab, setTab] = useState<TabId>(team ? "calendar" : "overview");
  const [detailsFor, setDetailsFor] = useState<Booking | null>(null);
  const [bookingModal, setBookingModal] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
  const [setupFor, setSetupFor] = useState<Booking | null>(null);
  const [payModal, setPayModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const goto = (t: TabId) => {
    setTab(t);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const newBooking = () => setBookingModal({ open: true, booking: null });
  const editBooking = (b: Booking) => setBookingModal({ open: true, booking: b });
  const pay = (id: string | null) => setPayModal({ open: true, id });

  const today = toISODate(new Date());
  const upcomingCount = data.bookings.filter((b) => b.date >= today && b.status !== "completed" && b.status !== "cancelled").length;
  const owed = data.bookings.reduce((s, b) => s + balanceOf(b), 0);
  const lowStock = stockAlerts(data, today, team).count > 0;
  // Prep reminders are for the crews doing the events, so only team logins have them
  const prepOpen = team ? prepReminders(data, today).filter((r) => r.open > 0).length : 0;
  const prepBadge = (active: boolean) => (
    <span className={`px-1.5 rounded-full text-xs font-bold ${active ? "bg-on-primary/15" : "bg-secondary-fixed text-on-secondary-fixed"}`}>{prepOpen}</span>
  );

  const badge = (id: TabId, active: boolean) => {
    if (id === "reminders" && prepOpen) return prepBadge(active);
    if (team) return id === "stock" && lowStock ? <span className="w-2 h-2 rounded-full bg-error" /> : null;
    if (id === "bookings" && upcomingCount)
      return <span className={`px-1.5 rounded-full text-xs font-semibold ${active ? "bg-on-primary/15" : "bg-surface-container-high"}`}>{upcomingCount}</span>;
    if (id === "payments" && owed > 0) return <span className="px-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold">{formatRMShort(owed)}</span>;
    if (id === "stock" && lowStock) return <span className="w-2 h-2 rounded-full bg-error" />;
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(43,30,26,0.04)]">
        <div className="h-16 md:h-20 max-w-[1440px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/logo.png" alt="JomSnap" width={48} height={40} className="h-9 md:h-10 w-auto object-contain" priority />
            <div className="flex flex-col min-w-0">
              <span className="text-headline-sm text-primary font-bold tracking-tight">{team ? `JomSnap · Team ${team}` : "JomSnap Admin"}</span>
              <span className="text-label-sm text-on-surface-variant hidden sm:block">{team ? "Schedule, days off & stock" : "Photobooth Bookings & Operations"}</span>
            </div>
            <SaveChip status={status.state} savedAt={savedAt} now={now} />
          </div>
          <div className="flex items-center gap-2">
            {!team && (
              <>
                <div className="hidden sm:block">
                  <Button variant="primary" icon="add" onClick={newBooking}>
                    New booking
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={newBooking}
                  className="sm:hidden w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center"
                  aria-label="New booking"
                >
                  <Icon name="add" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => goto("stock")}
              className="relative w-10 h-10 rounded-lg hover:bg-surface-container flex items-center justify-center"
              aria-label="Stock alerts"
            >
              <Icon name="inventory_2" />
              {lowStock && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error" />}
            </button>
            <form action={signOut} className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-outline-variant/40">
              <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-label-md font-bold uppercase">
                {user.slice(0, 2)}
              </span>
              <span className="hidden lg:flex flex-col leading-tight">
                <span className="text-label-md font-semibold text-on-surface">{user}</span>
                <span className="text-label-sm text-on-surface-variant">{team ? `Team ${team}` : "Admin"}</span>
              </span>
              <button type="submit" className="w-9 h-9 rounded-lg hover:bg-surface-container flex items-center justify-center" title="Sign out" aria-label="Sign out">
                <Icon name="logout" className="text-lg" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-5 md:py-8 space-y-5">
        {status.state === "error" && (
          <div role="alert" className="p-4 rounded-2xl bg-error-container text-on-error-container flex items-center gap-3">
            <Icon name="cloud_off" className="text-xl text-error" />
            <p className="flex-1 text-body-sm font-medium">{status.message} Your last change was not saved.</p>
          </div>
        )}

        {/* Desktop tab bar */}
        <nav className="hidden md:flex w-full bg-surface-container-low/80 p-1.5 rounded-2xl border border-outline-variant/30 shadow-sm items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goto(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-md font-medium transition-all shrink-0 ${
                  active ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <Icon name={t.icon} className={`text-base ${active ? "text-secondary-fixed" : ""}`} />
                {t.label}
                {badge(t.id, active)}
              </button>
            );
          })}
        </nav>

        {tab === "overview" && <Overview onNewBooking={newBooking} onGoto={goto} onPay={pay} />}
        {tab === "bookings" && <Bookings onNew={newBooking} onEdit={editBooking} onSetup={setSetupFor} onPay={pay} onInvoice={setInvoiceFor} />}
        {tab === "money" && <Money onAdd={(type) => setMoneyModal({ open: true, type })} onOpenPayment={(id) => pay(id)} />}
        {tab === "calendar" && <Calendar onEdit={team ? setDetailsFor : editBooking} />}
        {tab === "reminders" && <Reminders />}
        {tab === "payments" && <Payments onPay={pay} onInvoice={setInvoiceFor} />}
        {tab === "stock" && <Stock />}
        {tab === "backup" && <Backup />}
      </main>

      <footer className="w-full bg-surface-container-low py-6 md:py-10 mt-8">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-label-md text-on-surface-variant">
          <span>JomSnap (KT0620473-X) · © {new Date().getFullYear()}. Admin console.</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
            Neon database
          </span>
        </div>
      </footer>

      {/* Mobile bottom nav (from the Stitch "Field Ops" mobile screen) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 grid pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${mobileMain.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.filter((t) => mobileMain.includes(t.id)).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => goto(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-primary" : "text-outline"}`}
            >
              <Icon name={t.icon} filled={active} className="text-[22px]" />
              {t.short}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${mobileMain.includes(tab) ? "text-outline" : "text-primary"}`}
        >
          <Icon name="menu" className="text-[22px]" />
          More
          {lowStock && !team && <span className="absolute top-1.5 right-1/4 w-1.5 h-1.5 rounded-full bg-error" />}
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[55] bg-primary/40" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-surface-container-lowest p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-2 pb-3 mb-2 border-b border-outline-variant/30">
              <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-label-md font-bold uppercase">{user.slice(0, 2)}</span>
              <span className="flex-1 text-body-md font-semibold">{user}</span>
              <form action={signOut}>
                <Button type="submit" icon="logout">
                  Sign out
                </Button>
              </form>
            </div>
            {tabs.filter((t) => !mobileMain.includes(t.id)).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => goto(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-body-md ${tab === t.id ? "bg-surface-container font-semibold" : "hover:bg-surface-container-low"}`}
              >
                <Icon name={t.icon} className="text-xl text-on-surface-variant" />
                <span className="flex-1 text-left">{t.label}</span>
                {badge(t.id, false)}
              </button>
            ))}
          </div>
        </div>
      )}

      <BookingDetails booking={detailsFor} onClose={() => setDetailsFor(null)} />
      <SetupModal booking={setupFor} onClose={() => setSetupFor(null)} />
      <BookingModal open={bookingModal.open} booking={bookingModal.booking} onClose={() => setBookingModal({ open: false, booking: null })} />
      <InvoiceModal booking={invoiceFor} onClose={() => setInvoiceFor(null)} />
      <MoneyModal open={moneyModal.open} type={moneyModal.type} onClose={() => setMoneyModal((m) => ({ ...m, open: false }))} />
      <PaymentModal open={payModal.open} bookingId={payModal.id} onClose={() => setPayModal({ open: false, id: null })} />
    </div>
  );
}

/** Full page load after signing out, so the next account starts with nothing from this one in memory */
async function signOut() {
  await logout();
  window.location.replace("/admin/login");
}

function SaveChip({ status, savedAt, now }: { status: "saved" | "saving" | "error"; savedAt: string; now: number }) {
  const style = {
    saved: "bg-tertiary-fixed text-on-tertiary-fixed",
    saving: "bg-surface-container-high text-on-surface-variant",
    error: "bg-error-container text-on-error-container",
  }[status];
  return (
    <span className={`hidden lg:inline-flex items-center gap-1.5 ml-4 px-3 py-1 rounded-full text-label-md font-semibold ${style}`}>
      <Icon name={status === "saving" ? "progress_activity" : status === "error" ? "cloud_off" : "cloud_done"} className={`text-sm ${status === "saving" ? "animate-spin" : ""}`} />
      {status === "saving" ? "Saving…" : status === "error" ? "Not saved" : `Synced · updated ${timeAgo(savedAt, now)}`}
    </span>
  );
}
