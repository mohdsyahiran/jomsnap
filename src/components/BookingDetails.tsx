"use client";

import { GUESTBOOK_STYLE, PACKAGES, STATUS_STYLE } from "@/lib/constants";
import { formatDate, formatTime, safeUrl, whatsappLink } from "@/lib/format";
import { exportICS } from "@/lib/ics";
import type { Booking } from "@/lib/types";
import { Button, Icon, Modal, Pill } from "./ui";

/** What a team login sees when it opens an event: the job details, read-only, with no prices */
export function BookingDetails({ booking: b, onClose }: { booking: Booking | null; onClose: () => void }) {
  return (
    <Modal open={!!b} onClose={onClose} title={b ? `#${b.code} ${b.client}` : ""}>
      {b && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={STATUS_STYLE[b.status].className}>{STATUS_STYLE[b.status].label}</Pill>
            {b.guestbook && <Pill className={GUESTBOOK_STYLE[b.guestbook.status].className}>{GUESTBOOK_STYLE[b.guestbook.status].label}</Pill>}
          </div>
          <dl className="space-y-2.5 text-body-sm">
            <Row
              icon="event"
              label={`${formatDate(b.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${formatTime(b.startTime)}–${formatTime(b.endTime)}`}
            />
            <Row icon="location_on" label={`${b.venue}, ${b.area}`} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.venue)}`} />
            <Row icon="celebration" label={`${b.eventType} · ${PACKAGES[b.packageId].label}`} />
            {b.phone && <Row icon="chat" label={b.phone} href={whatsappLink(b.phone)} />}
            {b.backdrop && <Row icon="wallpaper" label={b.backdrop} />}
            {safeUrl(b.designUrl) && <Row icon="palette" label="Open design (Canva)" href={safeUrl(b.designUrl)} />}
            {b.notes && <Row icon="notes" label={b.notes} />}
          </dl>
          <div className="flex justify-end gap-2 pt-1">
            <Button icon="alarm_add" onClick={() => exportICS([b], `jomsnap-${b.code}.ics`)}>
              Add to calendar
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Row({ icon, label, href }: { icon: string; label: string; href?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon name={icon} className="text-base text-on-surface-variant mt-0.5" />
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-secondary hover:underline break-words">
          {label}
        </a>
      ) : (
        <span className="text-on-surface whitespace-pre-wrap break-words">{label}</span>
      )}
    </div>
  );
}
