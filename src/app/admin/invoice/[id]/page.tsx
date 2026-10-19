import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { loadSnapshot } from "@/lib/db";
import { balanceOf, formatTime, paidOf } from "@/lib/format";
import { BUSINESS, invoiceLines, paymentStatus, totalOf } from "@/lib/invoice";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";
import { InvoiceToolbar } from "./InvoiceToolbar";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-invoice" });

export const metadata: Metadata = { title: "Invoice · JomSnap" };

const money = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dots = (iso: string) => iso.split("-").reverse().join(".");
const slashes = (iso: string) => iso.split("-").reverse().join("/");
const shortTime = (t: string) => formatTime(t).replace(":00", "").replace(":", ".").replace(" ", "").toLowerCase();

/** "012-345 6789" → "+60 12 345 6789" */
function intlPhone(phone?: string) {
  if (!phone) return "";
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "60" + d.slice(1);
  if (!d.startsWith("60")) return phone;
  const r = d.slice(2);
  const parts = r.length === 9 ? [r.slice(0, 2), r.slice(2, 5), r.slice(5)] : r.length === 10 ? [r.slice(0, 2), r.slice(2, 6), r.slice(6)] : [r];
  return `+60 ${parts.join(" ")}`;
}

export default function InvoicePage(props: PageProps<"/admin/invoice/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-body-sm">Loading invoice…</p>}>
      <Invoice params={props.params} />
    </Suspense>
  );
}

async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const session = verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  // Invoices show prices and payments, which team logins don't get
  if (session.team) redirect("/admin");
  const { id } = await params;
  const { data } = await loadSnapshot();
  const b = data.bookings.find((x) => x.id === id);
  if (!b) notFound();

  const lines = invoiceLines(b);
  const total = totalOf(b);
  const paid = paidOf(b);
  const balance = balanceOf(b);
  const status = paymentStatus(b);
  const label = "text-[11px] font-bold tracking-[0.18em] uppercase";

  return (
    <div className={`${openSans.variable} min-h-screen print:min-h-0 bg-[#e9e6e3] print:bg-white`}>
      <InvoiceToolbar
        invoiceNo={b.invoiceNo}
        client={b.client}
        phone={b.phone}
        eventDate={slashes(b.date)}
        total={money(total)}
        paid={money(paid)}
        balance={money(balance)}
      />

      {/* On screen a full A4 sheet; in print it sizes to its content, so browser margins
          (Safari, Chrome "Default") can't push it onto a second page */}
      <article
        className="invoice-sheet mx-auto my-6 print:my-0 bg-white text-[#3a3a3a] shadow-lg print:shadow-none w-[210mm] max-w-full print:w-full min-h-[297mm] print:min-h-0 px-[17mm] py-[16mm] print:px-[12mm] print:py-[6mm] flex flex-col tracking-[0.06em] text-[13px] leading-[1.7] break-inside-avoid"
        style={{ fontFamily: "var(--font-invoice), sans-serif" }}
      >
        <h1 className="text-[46px] leading-none font-bold tracking-[0.18em]">INVOICE</h1>
        <Image src="/logo-wide.png" alt="JomSnap" width={900} height={328} priority className="mt-9 print:mt-6 w-[38mm] h-auto" />

        <section className="mt-8 print:mt-6">
          <p className={label}>{BUSINESS.name}</p>
          <p>{BUSINESS.regNo}</p>
          <p>
            {BUSINESS.phones[0]} /<br />
            {BUSINESS.phones[1]}
          </p>
          <p>{BUSINESS.email}</p>
        </section>

        <section className="mt-16 print:mt-8 flex justify-between gap-6">
          <div>
            <p className={label}>Bill to:</p>
            <p>{b.client}</p>
            {b.phone && <p>{intlPhone(b.phone)}</p>}
          </div>
          <dl className="text-right grid grid-cols-[auto_auto] gap-x-3 content-start">
            <dt className={label}>Invoice no:</dt>
            <dd className="font-bold">{b.invoiceNo ?? "DRAFT"}</dd>
            <dt className="uppercase tracking-[0.12em]">Date:</dt>
            <dd>{dots(b.invoiceDate ?? new Date().toISOString().slice(0, 10))}</dd>
            <dt className="uppercase tracking-[0.12em]">Payment status:</dt>
            <dd className="font-bold">{status}</dd>
          </dl>
        </section>

        <table className="mt-16 print:mt-8 w-full border-collapse">
          <thead>
            <tr className="border-b border-[#3a3a3a]">
              <th className={`${label} text-left font-bold pb-3 pl-3`}>Description</th>
              <th className={`${label} text-center pb-3`}>Price(RM)</th>
              <th className={`${label} text-center pb-3`}>Qty</th>
              <th className={`${label} text-right pb-3 pr-3`}>Total(RM)</th>
            </tr>
          </thead>
          <tbody className="border-b border-[#3a3a3a]">
            {lines.map((l, i) => (
              <tr key={i} className={`align-top ${i === 0 ? "[&>td]:pt-4" : "[&>td]:pt-2"} ${i === lines.length - 1 ? "[&>td]:pb-5" : ""}`}>
                <td className="pl-3">{l.description}</td>
                <td className="text-center">{l.price === "included" ? "INCLUDED" : money(l.price)}</td>
                <td className="text-center">{l.qty}</td>
                <td className="text-right pr-3">{l.total ? money(l.total) : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 px-3 space-y-2">
          <div className="flex justify-between">
            <span className={label}>Subtotal</span>
            <span className="font-bold">RM{money(total)}</span>
          </div>
          <div className="flex justify-end gap-8">
            <span className={label}>Total</span>
            <span className="font-bold">RM{money(total)}</span>
          </div>
          {status !== "PAID" && (
            <>
              <div className="flex justify-end gap-8">
                <span className={label}>Paid</span>
                <span className="font-bold">RM{money(paid)}</span>
              </div>
              <div className="flex justify-end gap-8">
                <span className={label}>Balance due</span>
                <span className="font-bold">RM{money(balance)}</span>
              </div>
            </>
          )}
        </div>

        <div className="mt-auto pt-16 print:pt-9 flex items-end justify-between gap-6">
          <div className="space-y-6">
            <section>
              <p className={label}>Event details</p>
              <p>
                {slashes(b.date)} | {shortTime(b.startTime)} - {shortTime(b.endTime)}
              </p>
              <p>{b.venue}</p>
            </section>
            <section>
              <p className={label}>Payment info:</p>
              <p>{BUSINESS.bank.name}</p>
              <p>Account Name: {BUSINESS.bank.accountName}</p>
              <p>Account No.: {BUSINESS.bank.accountNo}</p>
            </section>
          </div>
          {/* Round company stamp from the design */}
          <div className="w-[34mm] h-[34mm] shrink-0 rounded-full border-[3px] border-[#1d1d1d] flex items-center justify-center">
            <div className="w-[30mm] h-[30mm] rounded-full border border-[#1d1d1d] flex items-center justify-center">
              <Image src="/logo-wide.png" alt="" width={900} height={328} className="w-[25mm] h-auto" />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
