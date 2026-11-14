/** "tentative" is no longer offered; it only remains on old bookings until someone picks a new status */
export type BookingStatus = "confirmed" | "completed" | "cancelled" | "tentative";

export type Team = "HQ" | "Utara";

export type PackageId = "basic" | "standard" | "premium" | "custom";

export type Payment = {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method: PayMethod;
  note?: string;
  by?: string;
};

export type Extra = { label: string; amount: number };

/** What an event costs us to run; internal only, never on invoices or team screens */
export type CostKey = "crew" | "designer" | "transport" | "guestbook" | "other";

/** `note` says what an "other" cost was, e.g. "Parking" */
export type Cost = { type: CostKey; amount: number; note?: string };

export type PayMethod = "transfer" | "cash" | "duitnow" | "other" | "paylater";

export type Booking = {
  id: string;
  code: number;
  client: string;
  phone?: string;
  eventType: "Wedding" | "Corporate" | "Birthday" | "Engagement" | "Other";
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  venue: string;
  area: "Perak" | "Kuala Lumpur" | "Selangor" | "Other";
  packageId: PackageId;
  price: number;
  status: BookingStatus;
  payments: Payment[];
  suppliesDeducted: boolean;
  /** null when this booking has no guestbook (missing only in data saved before guestbooks were tracked) */
  guestbook?: GuestbookOrder | null;
  notes?: string;
  /** Which crew handles the event; missing on bookings made before teams existed */
  team?: Team;
  /** Backdrop colour/theme, e.g. "Floral white" */
  backdrop?: string;
  /** Link to the print/backdrop design (usually Canva) */
  designUrl?: string;
  /** Event prep ticked off from Reminders: the date each item was done (the guestbook uses its own status) */
  prep?: Partial<Record<"design" | "backdrop", string>>;
  /** Charges on top of the package, e.g. transportation */
  extras?: Extra[];
  /** Our own costs for this event, to see its nett profit */
  costs?: Cost[];
  /** Set the first time an invoice is issued, e.g. "JS-2026-001" */
  invoiceNo?: string;
  invoiceDate?: string; // YYYY-MM-DD
  createdAt: string;
};

export type StockItem = {
  id: string;
  /** Each team keeps its own stock */
  team: Team;
  name: string;
  unit: string;
  /** "count": a number with a minimum; "available": we have it (qty 1) or not (qty 0) */
  kind: "count" | "available";
  qty: number;
  /** OK when qty >= min */
  min: number;
};

/** Things to get ready in the week before an event */
export type PrepItem = "guestbook" | "design" | "backdrop";

export type GuestbookStatus = "pending" | "ordered" | "received";

/** Guestbooks are ordered per event, at least GUESTBOOK_LEAD_DAYS before it */
export type GuestbookOrder = {
  status: GuestbookStatus;
  orderedAt?: string; // YYYY-MM-DD
  receivedAt?: string; // YYYY-MM-DD
};

export type AuditEntry = {
  id: string;
  at: string; // ISO
  message: string;
  kind: "booking" | "payment" | "stock" | "money" | "system" | "schedule";
  by?: string;
  /** Set on entries a team should see in its own activity log */
  team?: Team;
};

/** Days a team can't take events, e.g. leave or another commitment */
export type Unavailability = {
  id: string;
  team: Team;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD, same as from for a single day
  note?: string;
  by?: string;
  createdAt: string;
};

/** A manual money entry. Booking payments are money in too, but live on the booking. */
export type Transaction = {
  id: string;
  type: "in" | "out";
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  method: PayMethod;
  note?: string;
  bookingId?: string;
  by?: string;
  createdAt: string;
};

/** How a one-off investment was paid for */
export type InvestMethod = "cash" | "card" | "paylater";

/** The owners who put their own money into the business */
export type Partner = "Syahiran" | "Mullah";

/** Equipment and setup bought to start the business; ROI measures earning this back */
export type Investment = {
  id: string;
  date: string; // YYYY-MM-DD
  item: string;
  amount: number;
  method: InvestMethod;
  /** Paid in instalments over this many months */
  months?: number;
  /** Part of an instalment item paid off in one go (e.g. one owner's share); the rest is spread over the months */
  settled?: number;
  /** How much each owner paid; missing on items nobody has filled in yet */
  paidBy?: Partial<Record<Partner, number>>;
  note?: string;
  by?: string;
  createdAt: string;
};

/** The real balance read off the business bank account, to compare with what the records say */
export type BankBalance = {
  amount: number;
  asOf: string; // YYYY-MM-DD
  by?: string;
};

export type AdminData = {
  schemaVersion: 1;
  bookings: Booking[];
  stock: StockItem[];
  audit: AuditEntry[];
  transactions: Transaction[];
  unavailability: Unavailability[];
  /** Missing in data saved before the ROI tab */
  investments: Investment[];
  /** Typical cost of running one event (paper, ink, transport, crew), for the ROI plan */
  costPerEvent: number;
  /** Missing until someone enters it */
  bank?: BankBalance;
  nextCode: number;
};
