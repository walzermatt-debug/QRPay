"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VENUE_TYPES = ["restaurant", "beach_club", "bar", "hotel"] as const;

export default function NewVenueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof VENUE_TYPES)[number]>("restaurant");
  const [country, setCountry] = useState("US");
  const [currency, setCurrency] = useState("usd");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          country: country.toUpperCase(),
          currency: currency.toLowerCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data.error));
      router.push(`/dashboard/venues/${data.venue.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create venue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          className="col-span-2 rounded-md border border-neutral-300 px-3 py-2"
          placeholder="Venue name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="rounded-md border border-neutral-300 px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as (typeof VENUE_TYPES)[number])}
        >
          {VENUE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="rounded-md border border-neutral-300 px-3 py-2"
            placeholder="Country (US)"
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <input
            className="rounded-md border border-neutral-300 px-3 py-2"
            placeholder="Currency (usd)"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !name.trim()}
        className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create venue"}
      </button>
    </div>
  );
}
