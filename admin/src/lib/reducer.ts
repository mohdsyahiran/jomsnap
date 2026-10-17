// Pure state transitions, shared by the browser and the server actions that persist to Neon
import { suppliesFor } from "./constants";
import { formatRM, toISODate, uid } from "./format";
import type { AdminData, AuditEntry, Booking, Payment, Transaction } from "./types";

export type Action =
  | { type: "load"; data: AdminData }
  | { type: "saveBooking"; booking: Omit<Booking, "id" | "code" | "createdAt" | "payments" | "suppliesDeducted"> & { id?: string } }
  | { type: "deleteBooking"; id: string }
  | { type: "setStatus"; id: string; status: Booking["status"] }
  | { type: "addPayment"; bookingId: string; payment: Omit<Payment, "id"> }
  | { type: "deletePayment"; bookingId: string; paymentId: string }
  | { type: "recordSupplies"; id: string }
  | { type: "adjustStock"; id: string; delta: number; cost?: number }
  | { type: "addTxn"; txn: Omit<Transaction, "id" | "createdAt" | "by"> }
  | { type: "deleteTxn"; id: string };

/** Who made the change; set on the server from the signed-in session */
export type Stamped = Action & { by?: string };

let currentBy: string | undefined;

function log(data: AdminData, kind: AuditEntry["kind"], message: string): AuditEntry[] {
  return [{ id: uid(), at: new Date().toISOString(), kind, message, by: currentBy }, ...data.audit].slice(0, 200);
}

/** Apply (sign = -1) or return (sign = +1) the consumables a booking uses. */
function moveSupplies(data: AdminData, b: Booking, sign: 1 | -1) {
  const usage = suppliesFor(b.packageId);
  return data.stock.map((s) => (usage[s.id] ? { ...s, qty: Math.max(0, s.qty + sign * usage[s.id]) } : s));
}

export function reducer(data: AdminData, action: Stamped): AdminData {
  currentBy = action.by;
  switch (action.type) {
    case "load":
      return normalize(action.data);

    case "saveBooking": {
      const { id, ...fields } = action.booking;
      if (id) {
        return {
          ...data,
          bookings: data.bookings.map((b) => (b.id === id ? { ...b, ...fields } : b)),
          audit: log(data, "booking", `Updated booking ${fields.client}`),
        };
      }
      const booking: Booking = { ...fields, id: uid(), code: data.nextCode, payments: [], suppliesDeducted: false, createdAt: new Date().toISOString() };
      return {
        ...data,
        bookings: [...data.bookings, booking],
        nextCode: data.nextCode + 1,
        audit: log(data, "booking", `New booking #${booking.code} ${booking.client}`),
      };
    }

    case "deleteBooking": {
      const b = data.bookings.find((x) => x.id === action.id);
      if (!b) return data;
      return {
        ...data,
        bookings: data.bookings.filter((x) => x.id !== action.id),
        stock: b.suppliesDeducted ? moveSupplies(data, b, 1) : data.stock,
        audit: log(data, "booking", `Deleted #${b.code} ${b.client}${b.suppliesDeducted ? " · supplies returned to stock" : ""}`),
      };
    }

    case "setStatus":
      return {
        ...data,
        bookings: data.bookings.map((b) => (b.id === action.id ? { ...b, status: action.status } : b)),
        audit: log(data, "booking", `Status of ${data.bookings.find((b) => b.id === action.id)?.client} → ${action.status}`),
      };

    case "addPayment": {
      const b = data.bookings.find((x) => x.id === action.bookingId);
      if (!b) return data;
      const payment = { ...action.payment, id: uid(), by: action.by };
      return {
        ...data,
        bookings: data.bookings.map((x) =>
          x.id === b.id ? { ...x, payments: [...x.payments, payment], status: x.status === "tentative" ? "confirmed" : x.status } : x,
        ),
        audit: log(data, "payment", `Payment ${formatRM(payment.amount)} from ${b.client}`),
      };
    }

    case "deletePayment": {
      const b = data.bookings.find((x) => x.id === action.bookingId);
      const p = b?.payments.find((x) => x.id === action.paymentId);
      if (!b || !p) return data;
      return {
        ...data,
        bookings: data.bookings.map((x) => (x.id === b.id ? { ...x, payments: x.payments.filter((y) => y.id !== p.id) } : x)),
        audit: log(data, "payment", `Removed payment ${formatRM(p.amount)} from ${b.client}`),
      };
    }

    case "recordSupplies": {
      const b = data.bookings.find((x) => x.id === action.id);
      // Idempotent: a booking can only deduct supplies once
      if (!b || b.suppliesDeducted) return data;
      return {
        ...data,
        stock: moveSupplies(data, b, -1),
        bookings: data.bookings.map((x) => (x.id === b.id ? { ...x, suppliesDeducted: true } : x)),
        audit: log(data, "stock", `Supplies used for #${b.code} ${b.client}`),
      };
    }

    case "adjustStock": {
      const s = data.stock.find((x) => x.id === action.id);
      if (!s || action.delta === 0) return data;
      // A restock with a cost is also money out
      const expense: Transaction[] = action.cost
        ? [
            {
              id: uid(),
              type: "out",
              amount: action.cost,
              date: toISODate(new Date()),
              category: "supplies",
              method: "transfer",
              note: `Restock ${s.name} +${action.delta}`,
              by: action.by,
              createdAt: new Date().toISOString(),
            },
          ]
        : [];
      return {
        ...data,
        stock: data.stock.map((x) => (x.id === s.id ? { ...x, qty: Math.max(0, x.qty + action.delta) } : x)),
        transactions: [...data.transactions, ...expense],
        audit: log(data, "stock", `${s.name} ${action.delta > 0 ? "+" : ""}${action.delta}${action.cost ? ` · cost ${formatRM(action.cost)}` : ""}`),
      };
    }

    case "addTxn": {
      const txn: Transaction = { ...action.txn, id: uid(), by: action.by, createdAt: new Date().toISOString() };
      return {
        ...data,
        transactions: [...data.transactions, txn],
        audit: log(data, "money", `Money ${txn.type} ${formatRM(txn.amount)} · ${txn.note || txn.category}`),
      };
    }

    case "deleteTxn": {
      const t = data.transactions.find((x) => x.id === action.id);
      if (!t) return data;
      return {
        ...data,
        transactions: data.transactions.filter((x) => x.id !== t.id),
        audit: log(data, "money", `Deleted money ${t.type} ${formatRM(t.amount)} · ${t.note || t.category}`),
      };
    }
  }
}

export function isAdminData(x: unknown): x is AdminData {
  const d = x as AdminData;
  return !!d && d.schemaVersion === 1 && Array.isArray(d.bookings) && Array.isArray(d.stock) && Array.isArray(d.audit) && typeof d.nextCode === "number";
}

/** Older saves and backups predate the money ledger */
export function normalize(d: AdminData): AdminData {
  return { ...d, transactions: Array.isArray(d.transactions) ? d.transactions : [] };
}
