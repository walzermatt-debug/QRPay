import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl, payUrlForSpot } from "@/lib/qr";
import PrintButton from "./PrintButton";

export default async function SpotPrintPage({
  params,
}: {
  params: Promise<{ venueId: string; spotId: string }>;
}) {
  const { venueId, spotId } = await params;

  const spot = await prisma.spot.findFirst({
    where: { id: spotId, venueId },
    include: { venue: true },
  });
  if (!spot) notFound();

  const payUrl = payUrlForSpot(spot.qrToken);
  const qrDataUrl = await generateQrDataUrl(payUrl);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-16 text-center print:py-0">
      <p className="mb-2 text-sm uppercase tracking-widest text-neutral-500">{spot.venue.name}</p>
      <h1 className="mb-8 text-4xl font-semibold">{spot.label}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URL */}
      <img src={qrDataUrl} alt={`QR code for ${spot.label}`} className="mb-8 h-72 w-72" />
      <p className="mb-1 text-lg font-medium">Scan to view your bill and pay</p>
      <p className="break-all text-sm text-neutral-400">{payUrl}</p>
      <PrintButton />
    </main>
  );
}
