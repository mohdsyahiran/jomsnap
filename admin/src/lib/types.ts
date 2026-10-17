export type BookingStatus = "tentative" | "confirmed" | "completed" | "cancelled";

export type PackageId = "basic" | "standard" | "premium" | "custom";

export type Payment = {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method: PayMethod;
  note?: string;
  by?: string;
};

export type PayMethod = "transfer" | "cash" | "duitnow" | "other";

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
  notes?: string;
  createdAt: string;
};

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  threshold: number;
  capacity: number;
};

export type AuditEntry = {
  id: string;
  at: string; // ISO
  message: string;
  kind: "booking" | "payment" | "stock" | "money" | "system";
  by?: string;
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

export type AdminData = {
  schemaVersion: 1;
  bookings: Booking[];
  stock: StockItem[];
  audit: AuditEntry[];
  transactions: Transaction[];
  nextCode: number;
};
