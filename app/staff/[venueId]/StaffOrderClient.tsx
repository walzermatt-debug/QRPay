"use client";

import { useState } from "react";
import type { POSTab } from "@/lib/pos";
import { formatMoney, toMinorUnits } from "@/lib/money";

type DraftItem = {
  name: string;
  quantity: string;
  unitPrice: string; // decimal string, e.g. "12.50"
};

const emptyDraftItem = (): DraftItem => ({ name: "", quantity: "1", unitPrice: "" });

export default function StaffOrderClient({
  venueId,
  venueName,
  currency,
  posSource,
  spotLabels,
  initialTabs,
  posError,
}: {
  venueId: string;
  venueName: string;
  currency: string;
  posSource: string;
  spotLabels: string[];
  initialTabs: POSTab[];
  posError: string | null;
}) {
  const [tabs, setTabs] = useState<POSTab[]>(initialTabs);
  const [spotLabel, setSpotLabel] = useState(spotLabels[0] ?? "");
  const [newSpotLabel, setNewSpotLabel] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyDraftItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const canOrder = posSource === "internal";

  async function refreshTabs() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/tabs`);
      const data = await res.json();
      if (res.ok) setTabs(data.tabs);
    } finally {
      setRefreshing(false);
    }
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addRow() {
    setItems((prev) => [...prev, emptyDraftItem()]);
  }

  function removeRow(index: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submit() {
    setError(null);
    const label = (spotLabel === "__new__" ? newSpotLabel : spotLabel).trim();
    if (!label) {
      setError("Choose or enter a spot label.");
      return;
    }

    const payloadItems = items
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name.trim(),
        quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1),
        unitPrice: toMinorUnits(item.unitPrice),
      }));

    if (payloadItems.length === 0) {
      setError("Add at least one item with a name.");
      return;
    }

    setSubmitting(true);
    try {
      if (spotLabel === "__new__" && newSpotLabel.trim()) {
        const spotRes = await fetch(`/api/venues/${venueId}/spots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: newSpotLabel.trim() }),
        });
        if (!spotRes.ok && spotRes.status !== 409) {
          const data = await spotRes.json();
          throw new Error(data.error?.formErrors?.join(", ") ?? "Failed to create spot");
        }
      }

      const res = await fetch(`/api/venues/${venueId}/tabs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotLabel: label, items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add items");

      setItems([emptyDraftItem()]);
      setNewSpotLabel("");
      await refreshTabs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm text-neutral-500">Staff order entry</p>
        <h1 className="text-2xl font-semibold">{venueName}</h1>
      </header>

      {posError && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Couldn&apos;t load open tabs from this venue&apos;s POS: {posError}
        </div>
      )}

      {!canOrder && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          This venue is connected to an external POS ({posSource}). Orders are keyed into that
          system directly — Venue Pay only reconciles payments against it.
        </div>
      )}

      {canOrder && (
        <section className="mb-10 rounded-xl border border-neutral-200 p-6">
          <h2 className="mb-4 text-lg font-medium">Add items to a tab</h2>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Spot</label>
            <select
              className="w-full rounded-md border border-neutral-300 px-3 py-2"
              value={spotLabel}
              onChange={(e) => setSpotLabel(e.target.value)}
            >
              {spotLabels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
              <option value="__new__">+ New spot…</option>
            </select>
            {spotLabel === "__new__" && (
              <input
                className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2"
                placeholder="e.g. Table 14"
                value={newSpotLabel}
                onChange={(e) => setNewSpotLabel(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                />
                <input
                  className="w-20 rounded-md border border-neutral-300 px-3 py-2"
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                />
                <input
                  className="w-28 rounded-md border border-neutral-300 px-3 py-2"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded-md border border-neutral-300 px-3 text-neutral-500 hover:bg-neutral-50"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            + Add another item
          </button>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-6 w-full rounded-md bg-neutral-900 px-4 py-3 font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Add to tab"}
          </button>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Open tabs</h2>
          <button
            type="button"
            onClick={refreshTabs}
            disabled={refreshing}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {tabs.length === 0 ? (
          <p className="text-sm text-neutral-500">No open tabs.</p>
        ) : (
          <ul className="space-y-3">
            {tabs.map((tab) => (
              <li key={tab.id} className="rounded-xl border border-neutral-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{tab.spotLabel}</span>
                  <span className="font-medium">{formatMoney(tab.subtotal, currency)}</span>
                </div>
                <ul className="space-y-1 text-sm text-neutral-600">
                  {tab.lineItems.map((li) => (
                    <li key={li.id} className="flex justify-between">
                      <span>
                        {li.quantity}× {li.name}
                      </span>
                      <span>{formatMoney(li.quantity * li.unitPrice, currency)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
