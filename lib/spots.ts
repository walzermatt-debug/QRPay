import { prisma } from "@/lib/prisma";

/** Resolves the opaque QR token from /pay/[spotToken] to a spot + its venue. */
export async function resolveSpotByToken(qrToken: string) {
  return prisma.spot.findUnique({
    where: { qrToken },
    include: { venue: true },
  });
}
