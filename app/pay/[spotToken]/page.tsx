import { notFound } from "next/navigation";
import { resolveSpotByToken } from "@/lib/spots";
import { getPOSAdapter } from "@/lib/pos";
import PayClient from "./PayClient";

export default async function PayPage({
  params,
}: {
  params: Promise<{ spotToken: string }>;
}) {
  const { spotToken } = await params;

  const spot = await resolveSpotByToken(spotToken);
  if (!spot) notFound();

  const adapter = await getPOSAdapter(spot.venueId);

  let tab: Awaited<ReturnType<typeof adapter.getTab>> = null;
  try {
    tab = await adapter.getTab(spot.venueId, spot.label);
  } catch {
    // A POS-backed venue without read support yet — treat as no open tab
    // rather than failing the whole page.
    tab = null;
  }

  return (
    <PayClient
      spotToken={spotToken}
      venueName={spot.venue.name}
      spotLabel={spot.label}
      currency={spot.venue.currency}
      tabId={tab?.id ?? null}
      initialTab={tab}
      canAcceptPayment={Boolean(spot.venue.stripeAccountId && spot.venue.stripeOnboarded)}
      publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
    />
  );
}
