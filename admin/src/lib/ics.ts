import { download } from "./download";
import type { Booking } from "./types";

const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

function vevent(b: Booking) {
  return [
    "BEGIN:VEVENT",
    `UID:jomsnap-${b.id}@jomsnap`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;TZID=Asia/Kuala_Lumpur:${stamp(b.date, b.startTime)}`,
    `DTEND;TZID=Asia/Kuala_Lumpur:${stamp(b.date, b.endTime)}`,
    `SUMMARY:${esc(`JomSnap #${b.code} – ${b.client}`)}`,
    `LOCATION:${esc(b.venue)}`,
    `DESCRIPTION:${esc(`${b.eventType} photobooth. Phone: ${b.phone ?? "-"}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:JomSnap event tomorrow – prepare booth & supplies",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:JomSnap setup in 2 hours",
    "END:VALARM",
    "END:VEVENT",
  ];
}

export function exportICS(bookings: Booking[], filename: string) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JomSnap//Admin//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...bookings.flatMap(vevent), "END:VCALENDAR"];
  download(lines.join("\r\n"), filename, "text/calendar;charset=utf-8");
}
