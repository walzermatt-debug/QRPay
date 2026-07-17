"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

async function fetchOnboardedStatus(venueId: string): Promise<boolean | null> {
  const res = await fetch(`/api/venues/${venueId}/stripe/status`);
  const data = await res.json();
  return res.ok ? Boolean(data.stripeOnboarded) : null;
}

export default function StripeConnectSection({
  venueId,
  initialOnboarded,
  hasAccount,
}: {
  venueId: string;
  initialOnboarded: boolean;
  hasAccount: boolean;
}) {
  const searchParams = useSearchParams();
  const [onboarded, setOnboarded] = useState(initialOnboarded);
  const [checking, setChecking] = useState(false);

  // Coming back from hosted onboarding — silently sync status in the
  // background, no loading indicator needed for this one.
  useEffect(() => {
    if (searchParams.get("onboarding") !== "return") return;
    fetchOnboardedStatus(venueId).then((result) => {
      if (result !== null) setOnboarded(result);
    });
  }, [venueId, searchParams]);

  async function handleManualRefresh() {
    setChecking(true);
    const result = await fetchOnboardedStatus(venueId);
    if (result !== null) setOnboarded(result);
    setChecking(false);
  }

  return (
    <section className="mb-10 flex items-center justify-between rounded-xl border border-neutral-200 p-6">
      <div>
        <h2 className="text-lg font-medium">Stripe Connect</h2>
        <p className="text-sm text-neutral-500">
          {onboarded
            ? "Connected — this venue can accept payments and receives payouts automatically."
            : hasAccount
              ? "Onboarding started but not finished yet."
              : "Not connected yet — customers can't pay until this is done."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={checking}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          {checking ? "Checking…" : "Refresh"}
        </button>
        <a
          href={`/api/venues/${venueId}/stripe/onboard`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {onboarded ? "Manage on Stripe" : hasAccount ? "Finish onboarding" : "Connect Stripe"}
        </a>
      </div>
    </section>
  );
}
