import { NextResponse } from "next/server";
import { z } from "zod";
import { getPOSAdapter } from "@/lib/pos";

// This is the one write path a venue with zero POS integration needs:
// staff key items in against a spot here. Goes exclusively through
// getPOSAdapter() — never a specific adapter — so a POS-backed venue
// naturally gets a rejection from its own adapter instead of this route
// having to know which venues are allowed to write.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;
  const adapter = await getPOSAdapter(venueId);
  const tabs = await adapter.listOpenTabs(venueId);
  return NextResponse.json({ tabs });
}

const addItemsSchema = z.object({
  spotLabel: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        // Minor currency units.
        unitPrice: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;
  const body = await request.json();
  const parsed = addItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const adapter = await getPOSAdapter(venueId);
  try {
    const tab = await adapter.addLineItems(venueId, parsed.data.spotLabel, parsed.data.items);
    return NextResponse.json({ tab }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add items";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
