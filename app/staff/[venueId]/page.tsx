import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPOSAdapter } from "@/lib/pos";
import StaffOrderClient from "./StaffOrderClient";

export default async function StaffPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) notFound();

  const spots = await prisma.spot.findMany({
    where: { venueId },
    orderBy: { label: "asc" },
  });

  const adapter = await getPOSAdapter(venueId);

  // Non-internal adapters (e.g. the Square stub) may not implement reads
  // yet — degrade to an empty list with an explanatory banner rather than
  // a 500, since the rest of the page (viewing venue info) still works.
  let openTabs: Awaited<ReturnType<typeof adapter.listOpenTabs>> = [];
  let posError: string | null = null;
  try {
    openTabs = await adapter.listOpenTabs(venueId);
  } catch (err) {
    posError = err instanceof Error ? err.message : "Failed to load tabs from POS";
  }

  return (
    <StaffOrderClient
      venueId={venue.id}
      venueName={venue.name}
      currency={venue.currency}
      posSource={venue.posSource}
      spotLabels={spots.map((s) => s.label)}
      initialTabs={openTabs}
      posError={posError}
    />
  );
}
