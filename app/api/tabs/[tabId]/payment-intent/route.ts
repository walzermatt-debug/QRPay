import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { calculatePlatformFee } from "@/lib/fees";

// Creates a PaymentIntent for one payer's share of a tab, using a
// destination charge. The platform fee is charged ON TOP of the bill share
// rather than deducted from it: the payer's card is charged
// (amount + tipAmount + platformFeeAmount), application_fee_amount takes
// exactly platformFeeAmount for us, and transfer_data.destination sends the
// rest — the full (amount + tipAmount) — to the venue untouched.
//
// A tab can have many of these, split two ways:
//   - Even split: the payer picks how many ways to divide whatever is
//     CURRENTLY remaining (not the original total) — self-correcting as
//     people pay, since amount is validated against remainingSubtotal.
//   - Choose items: the payer picks specific unpaid line items; amount is
//     computed server-side from those items' prices (never trusted from the
//     client) and the items are claimed to this payment immediately, before
//     the Stripe call, so a concurrent request can't double-claim the same
//     item. If the Stripe call then fails, the claim is released.

const bodySchema = z
  .object({
    tipAmount: z.number().int().min(0).default(0),
    email: z.string().email(),
    amount: z.number().int().positive().optional(),
    lineItemIds: z.array(z.string().min(1)).optional(),
  })
  .refine((data) => data.lineItemIds?.length || data.amount !== undefined, {
    message: "Provide either amount (even split) or lineItemIds (choose items)",
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tabId: string }> },
) {
  const { tabId } = await params;
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tipAmount, email, lineItemIds } = parsed.data;

  const tab = await prisma.tab.findUnique({
    where: { id: tabId },
    include: { venue: true, lineItems: true, payments: true },
  });
  if (!tab) {
    return NextResponse.json({ error: "Tab not found" }, { status: 404 });
  }
  if (tab.status === "paid" || tab.status === "void" || tab.status === "closed") {
    return NextResponse.json({ error: "Tab is not open for payment" }, { status: 409 });
  }
  if (!tab.venue.stripeAccountId || !tab.venue.stripeOnboarded) {
    return NextResponse.json(
      { error: "Venue has not completed Stripe onboarding yet" },
      { status: 409 },
    );
  }

  const subtotal = tab.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const paidTowardBill = tab.payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingSubtotal = Math.max(0, subtotal - paidTowardBill);

  let amount: number;
  let payment;

  if (lineItemIds && lineItemIds.length > 0) {
    // Choose-items mode: validate + claim atomically so two people can't
    // pay for the same item at once.
    try {
      payment = await prisma.$transaction(async (tx) => {
        const items = await tx.lineItem.findMany({
          where: { id: { in: lineItemIds }, tabId: tab.id, paymentId: null },
        });
        if (items.length !== lineItemIds.length) {
          throw new ItemsUnavailableError();
        }
        const itemsTotal = items.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
        const platformFeeAmount = calculatePlatformFee(itemsTotal, tab.venue.platformFeeBps);

        const created = await tx.payment.create({
          data: {
            tabId: tab.id,
            venueId: tab.venueId,
            amount: itemsTotal,
            tipAmount,
            platformFeeAmount,
            currency: tab.currency,
            payerEmail: email,
            status: "pending",
          },
        });

        const claimed = await tx.lineItem.updateMany({
          where: { id: { in: lineItemIds }, tabId: tab.id, paymentId: null },
          data: { paymentId: created.id },
        });
        if (claimed.count !== lineItemIds.length) {
          throw new ItemsUnavailableError();
        }

        return created;
      });
    } catch (err) {
      if (err instanceof ItemsUnavailableError) {
        return NextResponse.json(
          { error: "One or more selected items were just claimed by someone else. Refresh and try again." },
          { status: 409 },
        );
      }
      throw err;
    }
    amount = payment.amount;
  } else {
    amount = parsed.data.amount!;
    if (amount > remainingSubtotal) {
      return NextResponse.json(
        { error: "Amount exceeds what's still owed on this tab" },
        { status: 409 },
      );
    }
    const platformFeeAmount = calculatePlatformFee(amount, tab.venue.platformFeeBps);
    payment = await prisma.payment.create({
      data: {
        tabId: tab.id,
        venueId: tab.venueId,
        amount,
        tipAmount,
        platformFeeAmount,
        currency: tab.currency,
        payerEmail: email,
        status: "pending",
      },
    });
  }

  const total = amount + tipAmount + payment.platformFeeAmount;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: tab.currency,
      application_fee_amount: payment.platformFeeAmount,
      transfer_data: { destination: tab.venue.stripeAccountId },
      automatic_payment_methods: { enabled: true },
      // No receipt_email here — we send our own branded receipt (see
      // lib/email/sendReceipt.ts) from the webhook instead of relying on
      // Stripe's default, unbranded one.
      metadata: {
        tabId: tab.id,
        venueId: tab.venueId,
        paymentId: payment.id,
        amount: String(amount),
        tipAmount: String(tipAmount),
        lineItemIds: (lineItemIds ?? []).join(","),
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment.id,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    // Release any claimed items and the payment row — the charge never started.
    await prisma.lineItem.updateMany({
      where: { paymentId: payment.id },
      data: { paymentId: null },
    });
    await prisma.payment.delete({ where: { id: payment.id } });

    const message = err instanceof Error ? err.message : "Failed to start payment with Stripe";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

class ItemsUnavailableError extends Error {}
