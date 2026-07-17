import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Starts (or resumes) Stripe Connect Express onboarding for a venue.
// GET so it can be used directly as a link href/redirect target from the
// operator dashboard, and so it doubles as the account link's refresh_url
// (Stripe redirects back here if a previously issued link expired).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  let stripeAccountId = venue.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: venue.country,
      default_currency: venue.currency,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "company",
      metadata: { venueId: venue.id },
    });
    stripeAccountId = account.id;
    await prisma.venue.update({
      where: { id: venue.id },
      data: { stripeAccountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/api/venues/${venue.id}/stripe/onboard`,
    return_url: `${appUrl}/dashboard/venues/${venue.id}?onboarding=return`,
  });

  return NextResponse.redirect(accountLink.url, { status: 303 });
}
