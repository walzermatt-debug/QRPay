import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getPOSAdapter } from "@/lib/pos";
import { sendReceiptEmail } from "@/lib/email/sendReceipt";

// Single Stripe webhook endpoint for the platform account. Handles:
//   - account.updated: keeps Venue.stripeOnboarded in sync as connected
//     accounts complete (or lose) Express onboarding requirements.
//   - payment_intent.succeeded: marks our Payment row succeeded, calls the
//     venue's POS adapter markPaid() to reconcile the tab, and sends our
//     own branded receipt (not Stripe's default one — see
//     lib/email/sendReceipt.ts). Reconciliation is adapter-agnostic — an
//     InternalAdapter-backed venue gets its tab status flipped directly,
//     a real-POS-backed venue would get the tender recorded back into that
//     POS, and this handler doesn't need to know which.
//   - payment_intent.payment_failed: unsticks the Payment row so it
//     doesn't sit at "pending" forever.
//
// Must read the raw body for signature verification, so this route can't
// use request.json() before verifying.

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const stripeOnboarded = Boolean(account.details_submitted && account.charges_enabled);
      await prisma.venue.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeOnboarded },
      });
      break;
    }

    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: intent.id },
      });
      // Not one of ours (shouldn't happen on this endpoint), or this event
      // was already processed — webhooks can be delivered more than once.
      if (!payment || payment.status === "succeeded") break;

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "succeeded" },
      });

      const lineItemIds = intent.metadata.lineItemIds
        ? intent.metadata.lineItemIds.split(",").filter(Boolean)
        : undefined;

      const adapter = await getPOSAdapter(payment.venueId);
      await adapter.markPaid(payment.venueId, {
        externalId: payment.tabId,
        amountPaid: payment.amount,
        tipAmount: payment.tipAmount,
        paymentId: payment.id,
        lineItemIds,
      });

      // Never blocks/fails the webhook response — see sendReceiptEmail's
      // own error handling.
      await sendReceiptEmail(payment.id);
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await prisma.payment.findUnique({
        where: { stripePaymentIntentId: intent.id },
      });
      if (!payment || payment.status === "succeeded") break;

      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
      });
      // Release any items this payment had claimed in "choose items" mode.
      await prisma.lineItem.updateMany({
        where: { paymentId: payment.id },
        data: { paymentId: null },
      });
      break;
    }

    default:
      // Unhandled event types are expected and fine to ignore.
      break;
  }

  return NextResponse.json({ received: true });
}
