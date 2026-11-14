import type { Investment } from "./types";

/** "2026-05-29" plus n months, kept to the last day for short months (29 Jan + 1 → 28 Feb) */
function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const first = new Date(y, m - 1 + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${first.getFullYear()}-${p(first.getMonth() + 1)}-${p(Math.min(d, last))}`;
}

/**
 * Instalments of an item, assuming one a month starting a month after the purchase date.
 * Any amount paid off in one go (`settled`) comes off before the rest is split into months.
 * null for items paid in one go.
 */
export function instalmentsOf(i: Investment, today: string) {
  if (!i.months || i.months < 2) return null;
  const settled = i.settled ?? 0;
  const monthly = (i.amount - settled) / i.months;
  const dueDates = Array.from({ length: i.months }, (_, n) => addMonths(i.date, n + 1));
  const paid = dueDates.filter((d) => d <= today).length;
  const left = paid === i.months ? 0 : Math.round((i.amount - settled - monthly * paid) * 100) / 100;
  return { paid, months: i.months, monthly, left, settled, dueDates, nextDue: dueDates[paid] };
}
