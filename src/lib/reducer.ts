// Pure state transitions, shared by the browser and the server actions that persist to Neon
import { PACKAGES, SUPPLIES_PER_EVENT } from "./constants";
import { formatRM, toISODate, uid } from "./format";
import { DEFAULT_STOCK } from "./seed";
import type { AdminData, AuditEntry, Booking, GuestbookStatus, Payment, StockItem, Transaction } from "./types";

export type Action =
  | { type: "load"; data: AdminData }
  | {
      type: "saveBooking";
      booking: Omit<Booking, "id" | "code" | "createdAt" | "payments" | "suppliesDeducted" | "guestbook" | "invoiceNo" | "invoiceDate"> & { id?: string };
      guestbookNeeded: boolean;
    }
  | { type: "deleteBooking"; id: string }
  | { type: "setStatus"; id: string; status: Booking["status"] }
  | { type: "addPayment"; bookingId: string; payment: Omit<Payment, "id"> }
  | { type: "deletePayment"; bookingId: string; paymentId: string }
  | { type: "recordSupplies"; id: string }
  | { type: "adjustStock"; id: string; delta: number; cost?: number }
  | { type: "addTxn"; txn: Omit<Transaction, "id" | "createdAt" | "by"> }
  | { type: "deleteTxn"; id: string }
  | { type: "setGuestbook"; id: string; status: GuestbookStatus; cost?: number }
  | { type: "issueInvoice"; id: string; invoiceNo: string };

/** Who made the change; set on the server from the signed-in session */
export type Stamped = Action & { by?: string };

let currentBy: string | undefined;

function log(data: AdminData, kind: AuditEntry["kind"], message: string): AuditEntry[] {
  return [{ id: uid(), at: new Date().toISOString(), kind, message, by: currentBy }, ...data.audit].slice(0, 200);
}

/** Apply (sign = -1) or return (sign = +1) the consumables a booking uses. */
function moveSupplies(data: AdminData, b: Booking, sign: 1 | -1) {
  return data.stock.map((s) => (SUPPLIES_PER_EVENT[s.id] ? { ...s, qty: Math.max(0, s.qty + sign * SUPPLIES_PER_EVENT[s.id]) } : s));
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
          bookings: data.bookings.map((b) =>
            b.id === id ? { ...b, ...fields, guestbook: action.guestbookNeeded ? (b.guestbook ?? { status: "pending" }) : null } : b,
          ),
          audit: log(data, "booking", `Updated booking ${fields.client}`),
        };
      }
      const booking: Booking = {
        ...fields,
        id: uid(),
        code: data.nextCode,
        payments: [],
        suppliesDeducted: false,
        guestbook: action.guestbookNeeded ? { status: "pending" } : null,
        createdAt: new Date().toISOString(),
      };
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
          x.id === b.id ? { ...x, payments: [...x.payments, payment] } : x,
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
        stock: data.stock.map((x) => (x.id === s.id ? { ...x, qty: clampQty(x, x.qty + action.delta) } : x)),
        transactions: [...data.transactions, ...expense],
        audit: log(
          data,
          "stock",
          s.kind === "available"
            ? `${s.name} → ${action.delta > 0 ? "available" : "not available"}`
            : `${s.name} ${action.delta > 0 ? "+" : ""}${action.delta}${action.cost ? ` · cost ${formatRM(action.cost)}` : ""}`,
        ),
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

    case "setGuestbook": {
      const b = data.bookings.find((x) => x.id === action.id);
      if (!b?.guestbook || b.guestbook.status === action.status) return data;
      const today = toISODate(new Date());
      const guestbook = {
        status: action.status,
        orderedAt: action.status === "pending" ? undefined : (b.guestbook.orderedAt ?? today),
        receivedAt: action.status === "received" ? today : undefined,
      };
      // Ordering with a cost is also money out
      const expense: Transaction[] =
        action.status === "ordered" && action.cost
          ? [
              {
                id: uid(),
                type: "out",
                amount: action.cost,
                date: today,
                category: "supplies",
                method: "transfer",
                note: `Guestbook for #${b.code} ${b.client}`,
                bookingId: b.id,
                by: action.by,
                createdAt: new Date().toISOString(),
              },
            ]
          : [];
      return {
        ...data,
        bookings: data.bookings.map((x) => (x.id === b.id ? { ...x, guestbook } : x)),
        transactions: [...data.transactions, ...expense],
        audit: log(data, "stock", `Guestbook #${b.code} ${b.client} → ${action.status}${action.cost ? ` · ${formatRM(action.cost)}` : ""}`),
      };
    }

    case "issueInvoice": {
      const b = data.bookings.find((x) => x.id === action.id);
      const no = action.invoiceNo.trim();
      // Invoice numbers are unique across bookings
      if (!b || !no || b.invoiceNo === no || data.bookings.some((x) => x.id !== b.id && x.invoiceNo === no)) return data;
      return {
        ...data,
        bookings: data.bookings.map((x) => (x.id === b.id ? { ...x, invoiceNo: no, invoiceDate: x.invoiceDate ?? toISODate(new Date()) } : x)),
        audit: log(data, "booking", `Invoice ${no} for #${b.code} ${b.client}`),
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

const clampQty = (s: StockItem, qty: number) => Math.max(0, s.kind === "available" ? Math.min(1, qty) : qty);

type LegacyStock = Partial<StockItem> & { id: string; qty: number };

/**
 * Brings older saves and backups up to date:
 * - money ledger added (transactions)
 * - stock reduced to media rolls + props; ribbon/guestbook stock dropped
 * - guestbooks tracked per booking (Standard/Premium include one)
 */
export function normalize(d: AdminData): AdminData {
  const old = (d.stock ?? []) as LegacyStock[];
  const stock = DEFAULT_STOCK.map((def) => {
    const prev = old.find((s) => s.id === def.id);
    return { ...def, ...(prev?.kind ? prev : {}), qty: clampQty(def, prev?.qty ?? def.qty) };
  });
  const bookings = d.bookings.map((b) =>
    b.guestbook !== undefined ? b : { ...b, guestbook: PACKAGES[b.packageId]?.guestbook ? { status: "pending" as const } : null },
  );
  return { ...d, stock, bookings, transactions: Array.isArray(d.transactions) ? d.transactions : [] };
}
