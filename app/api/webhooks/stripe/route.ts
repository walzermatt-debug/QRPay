import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Single Stripe webhook endpoint for the platform account. Handles:
//   - account.updated: keeps Venue.stripeOnboarded in sync as connected
//     accounts complete (or lose) Express onboarding requirements.
//   - payment_intent.succeeded: reconciles tab payments — added in the
//     payments phase (see app/api/webhooks/stripe/route.ts history).
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

    default:
      // Unhandled event types are expected and fine to ignore.
      break;
  }

  return NextResponse.json({ received: true });
}
