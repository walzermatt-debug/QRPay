import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error("RESEND_API_KEY is not set");
}

export const resend = new Resend(apiKey);

// Must be a sender address on a domain verified in the Resend dashboard.
// Falls back to Resend's own test sender so local dev doesn't require
// domain verification — real receipts won't deliver to arbitrary
// addresses with that fallback, only to the Resend account's own email.
export const RECEIPT_FROM =
  process.env.RECEIPT_FROM_EMAIL ?? "Venue Pay <onboarding@resend.dev>";
