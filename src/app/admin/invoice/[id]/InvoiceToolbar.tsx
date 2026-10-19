"use client";

import Link from "next/link";
import { Icon } from "@/components/ui";
import { whatsappLink } from "@/lib/format";

type Props = { invoiceNo?: string; client: string; phone?: string; eventDate: string; total: string; paid: string; balance: string };

export function InvoiceToolbar({ invoiceNo, client, phone, eventDate, total, paid, balance }: Props) {
  const wa = whatsappLink(phone);
  const message = [
    `Hi ${client}, thank you for booking JomSnap Photobooth!`,
    ``,
    `Invoice: ${invoiceNo ?? "-"}`,
    `Event date: ${eventDate}`,
    `Total: RM${total}`,
    `Paid: RM${paid}`,
    Number(balance.replace(/,/g, "")) > 0 ? `Balance: RM${balance}` : `Status: PAID`,
    ``,
    `The invoice PDF is attached.`,
  ].join("\n");

  const btn = "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-label-md font-semibold";
  return (
    <div className="print:hidden sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-outline-variant/30">
      <div className="max-w-[210mm] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin" className={`${btn} hover:bg-surface-container text-on-surface-variant`}>
          <Icon name="arrow_back" className="text-base" />
          Back to admin
        </Link>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a href={`${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={`${btn} bg-tertiary-fixed text-on-tertiary-fixed`}>
              <Icon name="chat" className="text-base" />
              WhatsApp client
            </a>
          )}
          <button type="button" onClick={() => window.print()} className={`${btn} bg-primary text-on-primary`}>
            <Icon name="picture_as_pdf" className="text-base" />
            Download PDF / Print
          </button>
        </div>
      </div>
      <p className="max-w-[210mm] mx-auto px-4 pb-2 text-label-sm text-on-surface-variant">
        To save as PDF, choose <strong>Save as PDF</strong> as the printer. On a phone, tap Print, then Share → Save to Files.
      </p>
    </div>
  );
}
