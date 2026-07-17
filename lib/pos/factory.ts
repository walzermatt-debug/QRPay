import { prisma } from "@/lib/prisma";
import type { POSAdapter } from "./types";
import { InternalAdapter } from "./internalAdapter";
import { SquareAdapter } from "./squareAdapter";
import type { POSSource } from "@prisma/client";

// The only place in the codebase allowed to import a specific adapter.
// Every caller — API routes, the customer pay page, the webhook handler,
// the operator dashboard — goes through getPOSAdapter() and only ever
// touches the POSAdapter interface, never a vendor's adapter class.

const adapters: Record<POSSource, () => POSAdapter> = {
  internal: () => new InternalAdapter(),
  square: () => new SquareAdapter(),
};

/** Resolves the correct POSAdapter for a venue based on its posSource. */
export async function getPOSAdapter(venueId: string): Promise<POSAdapter> {
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: { posSource: true },
  });
  return adapters[venue.posSource]();
}

/** Same as getPOSAdapter, but skips the lookup when the venue is already in hand. */
export function getPOSAdapterFor(posSource: POSSource): POSAdapter {
  return adapters[posSource]();
}
