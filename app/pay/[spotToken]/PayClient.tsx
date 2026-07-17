"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import type { POSTab } from "@/lib/pos";
import { formatMoney } from "@/lib/money";
import CheckoutForm from "./CheckoutForm";

const TIP_PRESETS = [0, 10, 15, 20];
const SPLIT_MIN = 1;
const SPLIT_MAX = 12;

type Stage = "bill" | "checkout" | "success";

export default function PayClient({
  spotToken,
  venueName,
  spotLabel,
  currency,
  tabId,
  initialTab,
  canAcceptPayment,
  publishableKey,
}: {
  spotToken: string;
  venueName: string;
  spotLabel: string;
  currency: string;
  tabId: string | null;
  initialTab: POSTab | null;
  canAcceptPayment: boolean;
  publishableKey: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [refreshing, setRefreshing] = useState(false);
  const [splitCount, setSplitCount] = useState(1);
  const [tipPercent, setTipPercent] = useState<number>(15);
  const [customTip, setCustomTip] = useState("");
  const [tipMode, setTipMode] = useState<"preset" | "custom">("preset");
  const [stage, setStage] = useState<Stage>("bill");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripePromise] = useState(() =>
    publishableKey ? loadStripe(publishableKey) : null,
  );

  const subtotal = tab?.subtotal ?? 0;
  const perShare = tab ? Math.round(subtotal / splitCount) : 0;
  const effectiveTipPercent =
    tipMode === "custom" ? Number.parseFloat(customTip) || 0 : tipPercent;
  const tipAmount = Math.round(perShare * (effectiveTipPercent / 100));
  const total = perShare + tipAmount;

  async function refreshTab() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/spots/${spotToken}/tab`);
      const data = await res.json();
      if (res.ok) setTab(data.tab);
    } finally {
      setRefreshing(false);
    }
  }

  async function startCheckout() {
    if (!tabId || total <= 0) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tabs/${tabId}/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: perShare, tipAmount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "Couldn't start payment");
      setClientSecret(data.clientSecret);
      setStage("checkout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment");
    } finally {
      setStarting(false);
    }
  }

  if (stage === "success") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-950 px-6 text-center text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <div className="h-8 w-8 rounded-full bg-emerald-400" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold">You&apos;re all set</h1>
        <p className="mb-1 text-neutral-400">
          {formatMoney(total, currency)} paid to {venueName}
        </p>
        <p className="text-sm text-neutral-500">{spotLabel}</p>
      </div>
    );
  }

  if (stage === "checkout" && clientSecret && stripePromise) {
    return (
      <div className="flex min-h-dvh flex-col bg-neutral-950 text-white">
        <header className="px-5 pt-6">
          <p className="text-sm text-neutral-400">{venueName}</p>
          <p className="text-3xl font-semibold">{formatMoney(total, currency)}</p>
        </header>
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "night" } }}
        >
          <CheckoutForm
            total={total}
            currency={currency}
            onSuccess={() => setStage("success")}
            onBack={() => setStage("bill")}
          />
        </Elements>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-white">
      <header className="px-5 pb-4 pt-8">
        <p className="text-sm text-neutral-400">{venueName}</p>
        <h1 className="text-xl font-semibold">{spotLabel}</h1>
      </header>

      <main className="flex-1 space-y-8 overflow-y-auto px-5 pb-40">
        {/* Itemized bill */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              Your bill
            </h2>
            <button
              type="button"
              onClick={refreshTab}
              disabled={refreshing}
              className="text-sm text-neutral-400 hover:text-white"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {!tab || tab.lineItems.length === 0 ? (
            <p className="rounded-2xl border border-white/10 p-5 text-neutral-400">
              Nothing on your tab yet. Ask staff to open one, then refresh.
            </p>
          ) : (
            <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
              {tab.lineItems.map((li) => (
                <li key={li.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-neutral-200">
                    {li.quantity > 1 && (
                      <span className="text-neutral-500">{li.quantity}× </span>
                    )}
                    {li.name}
                  </span>
                  <span className="tabular-nums text-neutral-300">
                    {formatMoney(li.quantity * li.unitPrice, currency)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between px-4 py-3 font-medium">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(subtotal, currency)}</span>
              </li>
            </ul>
          )}
        </section>

        {/* Split control */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Split
          </h2>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setSplitCount((n) => Math.max(SPLIT_MIN, n - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl active:scale-95"
              aria-label="Split fewer ways"
            >
              −
            </button>
            <div className="text-center">
              <p className="text-2xl font-semibold tabular-nums">{splitCount}</p>
              <p className="text-xs text-neutral-500">
                {splitCount === 1 ? "way" : "ways"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSplitCount((n) => Math.min(SPLIT_MAX, n + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl active:scale-95"
              aria-label="Split more ways"
            >
              +
            </button>
          </div>
        </section>

        {/* Tip control */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Tip
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {TIP_PRESETS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setTipMode("preset");
                  setTipPercent(pct);
                }}
                className={`rounded-xl py-3 text-center text-sm font-medium transition ${
                  tipMode === "preset" && tipPercent === pct
                    ? "bg-white text-neutral-950"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTipMode("custom")}
            className={`mt-2 w-full rounded-xl py-3 text-center text-sm font-medium transition ${
              tipMode === "custom"
                ? "bg-white text-neutral-950"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            Custom
          </button>
          {tipMode === "custom" && (
            <input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              placeholder="Tip %"
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-transparent px-4 py-3 text-white placeholder:text-neutral-600"
            />
          )}
        </section>

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        {!canAcceptPayment && (
          <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300">
            This venue isn&apos;t set up to accept payments yet.
          </p>
        )}
      </main>

      {/* Sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-neutral-950/90 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
        <div className="mb-3 flex items-baseline justify-between text-sm text-neutral-400">
          <span>
            Your share {tipAmount > 0 && `+ ${formatMoney(tipAmount, currency)} tip`}
          </span>
          <span className="text-xl font-semibold text-white tabular-nums">
            {formatMoney(total, currency)}
          </span>
        </div>
        <button
          type="button"
          onClick={startCheckout}
          disabled={!tab || total <= 0 || !canAcceptPayment || starting}
          className="w-full rounded-2xl bg-white py-4 text-center text-lg font-semibold text-neutral-950 transition active:scale-[0.99] disabled:opacity-50"
        >
          {starting ? "Starting…" : `Pay ${formatMoney(total, currency)}`}
        </button>
      </div>
    </div>
  );
}
