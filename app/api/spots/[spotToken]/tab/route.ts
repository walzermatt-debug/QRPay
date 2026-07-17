import { NextResponse } from "next/server";
import { resolveSpotByToken } from "@/lib/spots";
import { getPOSAdapter } from "@/lib/pos";

// Powers the customer pay page's "refresh my bill" action — polling this
// after ordering more drinks should show the updated tab without a reload.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ spotToken: string }> },
) {
  const { spotToken } = await params;

  const spot = await resolveSpotByToken(spotToken);
  if (!spot) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  const adapter = await getPOSAdapter(spot.venueId);
  const tab = await adapter.getTab(spot.venueId, spot.label);

  return NextResponse.json({ tab });
}
