import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Pulls the connected account's current state from Stripe and syncs
// venue.stripeOnboarded. Called from the dashboard after the operator
// returns from hosted onboarding, and safe to poll — Stripe's
// account.updated webhook (see app/api/webhooks/stripe/route.ts) keeps
// this in sync in the background too, this route just avoids waiting on it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }
  if (!venue.stripeAccountId) {
    return NextResponse.json({ stripeOnboarded: false, started: false });
  }

  const account = await stripe.accounts.retrieve(venue.stripeAccountId);
  const stripeOnboarded = Boolean(
    account.details_submitted && account.charges_enabled,
  );

  if (stripeOnboarded !== venue.stripeOnboarded) {
    await prisma.venue.update({
      where: { id: venue.id },
      data: { stripeOnboarded },
    });
  }

  return NextResponse.json({
    started: true,
    stripeOnboarded,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requirementsDue: account.requirements?.currently_due ?? [],
  });
}
