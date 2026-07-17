import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { calculatePlatformFee } from "@/lib/fees";

// Creates a PaymentIntent for one payer's share of a tab, using a
// destination charge: the charge happens on the platform account, Stripe
// takes application_fee_amount for us, and the remainder auto-transfers to
// the venue's connected account via transfer_data.destination. A tab can
// have many of these (split across several people paying separately).

const bodySchema = z.object({
  // Minor currency units. amount excludes tip.
  amount: z.number().int().positive(),
  tipAmount: z.number().int().min(0).default(0),
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
  const { amount, tipAmount } = parsed.data;

  const tab = await prisma.tab.findUnique({
    where: { id: tabId },
    include: { venue: true },
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

  const total = amount + tipAmount;
  const platformFeeAmount = calculatePlatformFee(total, tab.venue.platformFeeBps);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: total,
    currency: tab.currency,
    application_fee_amount: platformFeeAmount,
    transfer_data: { destination: tab.venue.stripeAccountId },
    automatic_payment_methods: { enabled: true },
    metadata: {
      tabId: tab.id,
      venueId: tab.venueId,
      amount: String(amount),
      tipAmount: String(tipAmount),
    },
  });

  const payment = await prisma.payment.create({
    data: {
      tabId: tab.id,
      venueId: tab.venueId,
      amount,
      tipAmount,
      platformFeeAmount,
      currency: tab.currency,
      status: "pending",
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentId: payment.id,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
}
