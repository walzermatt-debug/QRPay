import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// NOTE: no auth yet (explicitly out of scope for this phase — see README).
// Anyone who can reach this API can create venues. Fine for internal /
// operator use during early rollout, not for public exposure.

const createVenueSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["restaurant", "beach_club", "bar", "hotel"]),
  country: z.string().length(2),
  currency: z.string().length(3).toLowerCase(),
  platformFeeBps: z.number().int().min(0).max(10000).optional(),
});

export async function GET() {
  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { spots: true, tabs: true } } },
  });
  return NextResponse.json({ venues });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createVenueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const venue = await prisma.venue.create({ data: parsed.data });
  return NextResponse.json({ venue }, { status: 201 });
}
