"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddSpotForm({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!label.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/spots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add spot");
      setLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add spot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
        placeholder="e.g. Table 8, Lounger 4, Cabana B"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add spot"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
