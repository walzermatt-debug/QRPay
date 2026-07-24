import { Resend } from "resend";

function createResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
}

let client: Resend | undefined;

// Lazy for the same reason as lib/stripe.ts — constructing eagerly at
// module scope throws during Next.js's build-time page data collection,
// which imports this module without runtime secrets available.
export const resend: Resend = new Proxy({} as Resend, {
  get(_target, prop, receiver) {
    if (!client) client = createResendClient();
    return Reflect.get(client, prop, receiver);
  },
});

// Must be a sender address on a domain verified in the Resend dashboard.
// Falls back to Resend's own test sender so local dev doesn't require
// domain verification — real receipts won't deliver to arbitrary
// addresses with that fallback, only to the Resend account's own email.
export const RECEIPT_FROM =
  process.env.RECEIPT_FROM_EMAIL ?? "Venue Pay <onboarding@resend.dev>";
