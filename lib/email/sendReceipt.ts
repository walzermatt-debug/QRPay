import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { resend, RECEIPT_FROM } from "./resend";
import { ReceiptDocument, type ReceiptData } from "./ReceiptDocument";

function receiptEmailHtml(data: ReceiptData): string {
  const total = formatMoney(data.total, data.currency);
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:40px 20px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111111;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;text-align:center;">
      <tr><td style="font-size:28px;font-weight:700;padding-bottom:8px;">${escapeHtml(data.venueName)}</td></tr>
      <tr><td style="font-size:18px;color:#333333;padding-bottom:16px;">Thanks for your visit</td></tr>
      <tr><td style="font-size:14px;color:#666666;padding-bottom:24px;">Here's the receipt for your payment.</td></tr>
      <tr><td style="font-size:20px;font-weight:600;padding-bottom:32px;">Total paid: ${total}</td></tr>
      <tr><td style="border-top:1px solid #e5e5e5;padding-top:20px;font-size:12px;color:#999999;">
        The itemized receipt is attached as a PDF.
      </td></tr>
    </table>
  </body>
</html>`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Sends our own branded receipt (HTML email + itemized PDF) for a
 * succeeded payment — not Stripe's default receipt email, which is
 * unbranded and comes from Stripe rather than the venue. Never throws:
 * failures are recorded on the Payment row (receiptError) rather than
 * propagated, since a receipt failure shouldn't affect payment
 * reconciliation, which has already happened by the time this runs.
 */
export async function sendReceiptEmail(paymentId: string): Promise<void> {
  try {
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: {
        lineItems: true,
        tab: { include: { venue: true, spot: true } },
      },
    });

    if (!payment.payerEmail) {
      throw new Error("Payment has no payerEmail on file");
    }

    const data: ReceiptData = {
      receiptId: payment.id.slice(-8).toUpperCase(),
      venueName: payment.tab.venue.name,
      venueAddress: payment.tab.venue.address,
      spotLabel: payment.tab.spot.label,
      paidAt: payment.updatedAt,
      currency: payment.currency,
      items: payment.lineItems.map((li) => ({
        name: li.name,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })),
      unitemizedShare: payment.lineItems.length === 0 ? payment.amount : null,
      tipAmount: payment.tipAmount,
      feeAmount: payment.platformFeeAmount,
      total: payment.amount + payment.tipAmount + payment.platformFeeAmount,
    };

    const pdfBuffer = await renderToBuffer(ReceiptDocument({ data }));

    const { error } = await resend.emails.send({
      from: RECEIPT_FROM,
      to: payment.payerEmail,
      subject: `Your receipt from ${data.venueName}`,
      html: receiptEmailHtml(data),
      attachments: [
        {
          filename: `receipt-${data.venueName.replace(/\s+/g, "-").toLowerCase()}-${data.receiptId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    if (error) throw new Error(error.message);

    await prisma.payment.update({
      where: { id: paymentId },
      data: { receiptSentAt: new Date(), receiptError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send receipt";
    console.error(`sendReceiptEmail(${paymentId}) failed:`, message);
    await prisma.payment
      .update({ where: { id: paymentId }, data: { receiptError: message } })
      .catch(() => {
        // Payment row may not exist in edge cases (e.g. bad id) — nothing more to do.
      });
  }
}
