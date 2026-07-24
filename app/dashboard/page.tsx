import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewVenueForm from "./NewVenueForm";

// Always render at request time. Without this, Next.js treats this page as
// static-eligible (no dynamic APIs used) and prerenders it at build time —
// baking in a snapshot of whatever venues exist then, and requiring a live
// DB connection during the build itself.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const venues = await prisma.venue.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { spots: true, tabs: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold">Venues</h1>
        <p className="text-sm text-neutral-500">
          No login yet — this dashboard is unauthenticated. See README for the known gap.
        </p>
      </header>

      <section className="my-8 rounded-xl border border-neutral-200 p-6">
        <h2 className="mb-4 text-lg font-medium">Add a venue</h2>
        <NewVenueForm />
      </section>

      <section>
        {venues.length === 0 ? (
          <p className="text-sm text-neutral-500">No venues yet.</p>
        ) : (
          <ul className="space-y-3">
            {venues.map((venue) => (
              <li key={venue.id}>
                <Link
                  href={`/dashboard/venues/${venue.id}`}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 hover:border-neutral-400"
                >
                  <div>
                    <p className="font-medium">{venue.name}</p>
                    <p className="text-sm text-neutral-500">
                      {venue.type.replace("_", " ")} · {venue.country} · {venue.currency.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right text-sm text-neutral-500">
                    <p>{venue._count.spots} spots</p>
                    <p>{venue.stripeOnboarded ? "Stripe connected" : "Not connected"}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
