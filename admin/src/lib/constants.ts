import type { BookingStatus, PackageId } from "./types";

// Mirrors the packages section on the public site (index.html)
export const PACKAGES: Record<PackageId, { label: string; hours: number; price: number; guestbook: boolean }> = {
  basic: { label: "Basic · 2 Hours", hours: 2, price: 580, guestbook: false },
  standard: { label: "Standard · 3 Hours", hours: 3, price: 690, guestbook: true },
  premium: { label: "Premium · 4 Hours", hours: 4, price: 790, guestbook: true },
  custom: { label: "Custom", hours: 0, price: 0, guestbook: false },
};

export const STATUS_STYLE: Record<BookingStatus, { label: string; className: string }> = {
  tentative: { label: "Tentative", className: "bg-secondary-fixed text-on-secondary-fixed" },
  confirmed: { label: "Confirmed", className: "bg-tertiary-fixed text-on-tertiary-fixed" },
  completed: { label: "Completed", className: "bg-surface-container-highest text-on-surface-variant" },
  cancelled: { label: "Cancelled", className: "bg-error-container text-on-error-container" },
};

// Consumables used per event when "Record supplies used" is pressed
export function suppliesFor(packageId: PackageId): Record<string, number> {
  const usage: Record<string, number> = { "media-4x6": 1, ribbon: 1 };
  if (PACKAGES[packageId].guestbook) usage.guestbook = 1;
  return usage;
}

// v2: starts empty (v1 held sample data from the first preview)
export const STORAGE_KEY = "jomsnap-admin-v2";

export const MONEY_OUT_CATEGORIES = [
  { id: "supplies", label: "Supplies (paper, ink)", icon: "print" },
  { id: "transport", label: "Fuel & transport", icon: "local_gas_station" },
  { id: "toll", label: "Toll & parking", icon: "toll" },
  { id: "crew", label: "Crew pay", icon: "groups" },
  { id: "equipment", label: "Equipment", icon: "photo_camera" },
  { id: "props", label: "Props & backdrop", icon: "celebration" },
  { id: "marketing", label: "Marketing & ads", icon: "campaign" },
  { id: "maintenance", label: "Repair & maintenance", icon: "build" },
  { id: "other-out", label: "Other expense", icon: "receipt_long" },
] as const;

export const MONEY_IN_CATEGORIES = [
  { id: "booking", label: "Booking payment", icon: "event_available" },
  { id: "addon", label: "Add-on / extra prints", icon: "add_photo_alternate" },
  { id: "capital", label: "Owner capital", icon: "savings" },
  { id: "other-in", label: "Other income", icon: "payments" },
] as const;

export function categoryOf(id: string) {
  return [...MONEY_OUT_CATEGORIES, ...MONEY_IN_CATEGORIES].find((c) => c.id === id) ?? { id, label: id, icon: "sell" };
}

export const PAY_METHODS = { transfer: "Bank transfer", duitnow: "DuitNow QR", cash: "Cash", other: "Other" } as const;
