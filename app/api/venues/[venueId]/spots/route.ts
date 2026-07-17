import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Spot is our own concept (a physical anchor + QR token) and exists
// regardless of a venue's posSource, so this stays outside lib/pos/.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;
  const spots = await prisma.spot.findMany({
    where: { venueId },
    orderBy: { label: "asc" },
  });
  return NextResponse.json({ spots });
}

const createSpotSchema = z.object({
  label: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;
  const body = await request.json();
  const parsed = createSpotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  const existing = await prisma.spot.findUnique({
    where: { venueId_label: { venueId, label: parsed.data.label } },
  });
  if (existing) {
    return NextResponse.json({ error: "A spot with that label already exists" }, { status: 409 });
  }

  const spot = await prisma.spot.create({
    data: { venueId, label: parsed.data.label },
  });
  return NextResponse.json({ spot }, { status: 201 });
}
