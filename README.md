# Venue Pay

QR-code payments for restaurants, beach clubs, and other venues that run a
tab. Customer scans a QR code at their table/lounger, sees the live bill,
splits it (evenly, or by picking specific items), tips, pays with a card or
Apple/Google Pay — no app download. A receipt is emailed automatically.
Venue Pay is the experience/ops layer on top of Stripe Connect, not a
payment institution: money moves directly from the customer's card to the
venue's Stripe account. The platform fee is charged **on top** of the bill
(not deducted from it) — the venue always receives the full item share plus
tip.

## Architecture

**Every venue is launchable with zero POS integration.** Most beach clubs
and small restaurants run tabs on paper today; Venue Pay can be the order
system of record for them. The `POSAdapter` interface (`lib/pos/`) is what
makes the rest of the app not care whether a venue's tab data lives in our
own database or a real POS:

- `lib/pos/types.ts` — the interface contract (`listOpenTabs`, `getTab`,
  `addLineItems`, `markPaid`).
- `lib/pos/internalAdapter.ts` — reads/writes our own database. Default for
  every venue.
- `lib/pos/squareAdapter.ts` — commented stub. Square is the intended first
  real POS integration (self-serve API, no partner-approval gate), not
  built yet.
- `lib/pos/factory.ts` — resolves the right adapter per venue from
  `Venue.posSource`. **No code outside `lib/pos/` should import a specific
  adapter or reference a POS vendor by name** — always go through
  `getPOSAdapter(venueId)`.

Payments use Stripe Connect Express accounts with destination charges
(`application_fee_amount` + `transfer_data.destination`): the platform
account creates the PaymentIntent, Stripe takes our cut, the rest
transfers to the venue automatically. The fee is added on top rather than
taken out of the venue's cut — see "Fee model" below.

### Data model (`prisma/schema.prisma`)

`Venue` → `Spot` (a table/lounger/cabana, with a QR token) → `Tab` →
`LineItem`, and `Payment` (a tab can have several, since it can be split
across multiple people paying separately). A `LineItem.paymentId` links an
item to the payment that covered it — set only when a customer paid via
"choose items" mode, which locks that item out of what's offered to the
next scanner.

### Fee model — charged on top, not deducted

The payer's card is charged `amount + tipAmount + platformFeeAmount`, where
`amount` is their item share (excluding tip) and `platformFeeAmount` is
`platformFeeBps` of `amount` only (tip is never fee'd). `application_fee_amount`
takes exactly the fee for the platform; `transfer_data.destination` sends
the rest — the full `amount + tipAmount` — to the venue, untouched. See
`app/api/tabs/[tabId]/payment-intent/route.ts`.

### Two ways to split a tab

- **Split evenly**: divides whatever's *currently remaining* on the tab
  (not the original total) by however many people the payer says are left.
  Self-corrects as people pay — whoever scans next just enters how many are
  left and splits what's actually still owed.
- **Choose items**: the payer picks specific unpaid line items; the amount
  is computed server-side from those items' prices (never trusted from the
  client) and the items are claimed to that payment atomically — before the
  Stripe call — so two people can't pay for the same item. If the Stripe
  call then fails, the claim is released. On `payment_intent.payment_failed`,
  any items claimed by that payment are released too.

Mixing the two modes on the same tab is supported but not fully
reconciled: an even-split payment reduces the remaining balance without
marking any specific item paid, so it's possible for "choose items" to
still offer an item that's effectively already covered by someone's even
split. Fine for the common case (a table picks one mode), a known
simplification otherwise.

### Payment methods and receipts

Checkout uses Stripe's Payment Element with `automatic_payment_methods`
and explicit `wallets: { applePay: 'auto', googlePay: 'auto' }`, so Apple
Pay / Google Pay buttons appear automatically above a manual card-entry
tab when the device/browser supports them. **Apple Pay additionally
requires verifying your domain in the Stripe Dashboard** (Settings →
Payment methods → Apple Pay) — without that, only Google Pay and card
entry will appear.

A receipt email is required before paying (one field, used regardless of
payment method — Apple/Google Pay don't reliably expose an email to us
before confirmation, so this is the simple, uniform way to guarantee a
receipt has somewhere to go). It's stored on `Payment.payerEmail`.

### Branded receipts (`lib/email/`)

We send our **own** receipt — not Stripe's default one, which is unbranded
and comes from Stripe rather than the venue. `payment_intent.succeeded`
calls `sendReceiptEmail(paymentId)`, which:

1. Renders an itemized PDF (`ReceiptDocument.tsx`, via `@react-pdf/renderer`)
   — venue name/address, the items this payment covered (or "Your share of
   the bill" for an even-split payment that doesn't map to specific items),
   tip, fee, and total.
2. Emails it via Resend (`resend.ts`) with a short branded HTML body and
   the PDF attached, from `RECEIPT_FROM_EMAIL`.
3. Records `Payment.receiptSentAt` on success or `Payment.receiptError` on
   failure — visible as a "Receipt sent" / "Receipt not sent" tag per
   payment on the operator dashboard.

`sendReceiptEmail` never throws — a receipt failure is recorded but never
blocks or fails the webhook, since payment reconciliation has already
happened by the time it runs. **`RECEIPT_FROM_EMAIL` must be on a domain
verified in the Resend dashboard** to deliver to arbitrary addresses;
without one it falls back to Resend's own test sender, which only
delivers to the Resend account's own email — fine for local dev, not for
production.

### App surfaces

- `/staff/[venueId]` — key items onto a spot's tab. This is what makes a
  venue launchable without a POS.
- `/pay/[spotToken]` — the customer flow: scan → itemized bill → split
  evenly or choose items → tip → email → pay via Stripe's Payment Element
  (card, Apple Pay, or Google Pay).
- `/dashboard` and `/dashboard/venues/[venueId]` — operator view: Stripe
  Connect onboarding status, spots with printable QR codes, open tabs,
  recent payments.
- `app/api/webhooks/stripe` — `payment_intent.succeeded` marks the Payment
  row succeeded and calls the venue's adapter `markPaid()` to reconcile the
  tab (locking any claimed items); `payment_intent.payment_failed` releases
  claimed items; `account.updated` keeps onboarding status in sync.

## Known gaps (intentional, out of scope for this pass)

- **No auth/login.** `/dashboard` and `/staff/[venueId]` are unauthenticated
  — anyone with the URL can create venues, key in orders, or view payment
  history. Needs an auth layer before any real deployment.
- **No real POS integrations.** Only `InternalAdapter` is implemented;
  `SquareAdapter` is a stub that throws on every method.
- **No native app.** Web only, accessed via QR code.

## Local development

```bash
cp .env.example .env   # fill in DATABASE_URL and Stripe test keys
npm install
npx prisma migrate dev
npm run db:seed         # optional: one sample venue + spots
npm run dev
```

Stripe webhooks (for local testing) need the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET`.
