import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPOSAdapter } from "@/lib/pos";
import { generateQrDataUrl, payUrlForSpot } from "@/lib/qr";
import { formatMoney } from "@/lib/money";
import StripeConnectSection from "./StripeConnectSection";
import AddSpotForm from "./AddSpotForm";

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-800",
  pending: "bg-neutral-100 text-neutral-600",
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  canceled: "bg-neutral-100 text-neutral-500",
};

export default async function VenueDashboardPage({
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
  const spotsWithQr = await Promise.all(
    spots.map(async (spot) => ({
      ...spot,
      payUrl: payUrlForSpot(spot.qrToken),
      qrDataUrl: await generateQrDataUrl(payUrlForSpot(spot.qrToken)),
    })),
  );

  const adapter = await getPOSAdapter(venueId);
  let openTabs: Awaited<ReturnType<typeof adapter.listOpenTabs>> = [];
  let posError: string | null = null;
  try {
    openTabs = await adapter.listOpenTabs(venueId);
  } catch (err) {
    posError = err instanceof Error ? err.message : "Failed to load open tabs";
  }

  const payments = await prisma.payment.findMany({
    where: { venueId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { tab: { include: { spot: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Venues
          </Link>
          <h1 className="text-2xl font-semibold">{venue.name}</h1>
          <p className="text-sm text-neutral-500">
            {venue.type.replace("_", " ")} · {venue.country} · {venue.currency.toUpperCase()} ·{" "}
            platform fee {(venue.platformFeeBps / 100).toFixed(2)}%
          </p>
        </div>
        <Link
          href={`/staff/${venue.id}`}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Open staff screen →
        </Link>
      </div>

      <StripeConnectSection
        venueId={venue.id}
        initialOnboarded={venue.stripeOnboarded}
        hasAccount={Boolean(venue.stripeAccountId)}
      />

      <section className="mb-10 rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-medium">Spots &amp; QR codes</h2>
        <AddSpotForm venueId={venue.id} />

        {spotsWithQr.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No spots yet.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {spotsWithQr.map((spot) => (
              <div key={spot.id} className="rounded-lg border border-neutral-200 p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URL, not an optimizable remote asset */}
                <img src={spot.qrDataUrl} alt={`QR code for ${spot.label}`} className="mx-auto mb-2 h-32 w-32" />
                <p className="font-medium">{spot.label}</p>
                <Link
                  href={`/dashboard/venues/${venue.id}/spots/${spot.id}/print`}
                  className="mt-1 inline-block text-sm text-neutral-500 hover:text-neutral-800"
                >
                  Print →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Open tabs</h2>
        {posError && <p className="mb-3 text-sm text-amber-700">{posError}</p>}
        {openTabs.length === 0 ? (
          <p className="text-sm text-neutral-500">No open tabs.</p>
        ) : (
          <ul className="space-y-2">
            {openTabs.map((tab) => (
              <li
                key={tab.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
              >
                <span className="font-medium">{tab.spotLabel}</span>
                <span className="text-sm text-neutral-600">{tab.lineItems.length} items</span>
                <span className="font-medium">{formatMoney(tab.subtotal, venue.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Recent payments</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-neutral-500">No payments yet.</p>
        ) : (
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm"
              >
                <span className="font-medium">{payment.tab.spot.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[payment.status] ?? ""}`}
                >
                  {payment.status}
                </span>
                <span className="text-neutral-500">
                  tip {formatMoney(payment.tipAmount, payment.currency)}
                </span>
                <span className="text-neutral-500">
                  fee {formatMoney(payment.platformFeeAmount, payment.currency)}
                </span>
                <span className="font-medium">
                  {formatMoney(payment.amount + payment.tipAmount, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
