"use client";

import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { formatMoney } from "@/lib/money";

export default function CheckoutForm({
  total,
  currency,
  onSuccess,
  onBack,
}: {
  total: number;
  currency: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Payment failed. Try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      onSuccess();
      return;
    }

    setError("Payment did not complete. Try again.");
    setSubmitting(false);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 px-5 pb-32 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-sm text-neutral-400 hover:text-neutral-200"
        >
          ← Back
        </button>
        {/*
          Wallets (Apple Pay / Google Pay) render as buttons above the tabs
          automatically when the device/browser supports them and the
          domain is verified for Apple Pay in the Stripe Dashboard — see
          README. "card" stays available as a tab either way, covering
          manual entry.
        */}
        <PaymentElement
          options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }}
        />
        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-neutral-950/90 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 backdrop-blur">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!stripe || submitting}
          className="w-full rounded-2xl bg-white py-4 text-center text-lg font-semibold text-neutral-950 transition active:scale-[0.99] disabled:opacity-50"
        >
          {submitting ? "Processing…" : `Pay ${formatMoney(total, currency)}`}
        </button>
      </div>
    </div>
  );
}
