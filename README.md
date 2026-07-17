# Venue Pay

QR-code payments for restaurants, beach clubs, and other venues that run a
tab. Customer scans a QR code at their table/lounger, sees the live bill,
splits it, tips, pays — no app download. Venue Pay is the experience/ops
layer on top of Stripe Connect, not a payment institution: money moves
directly from the customer's card to the venue's Stripe account, minus our
platform fee.

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
transfers to the venue automatically.

### Data model (`prisma/schema.prisma`)

`Venue` → `Spot` (a table/lounger/cabana, with a QR token) → `Tab` →
`LineItem`, and `Payment` (a tab can have several, since it can be split
across multiple people paying separately).

### App surfaces

- `/staff/[venueId]` — key items onto a spot's tab. This is what makes a
  venue launchable without a POS.
- `/pay/[spotToken]` — the customer flow: scan → itemized bill → choose
  split → choose tip → pay via Stripe's Payment Element.
- `/dashboard` and `/dashboard/venues/[venueId]` — operator view: Stripe
  Connect onboarding status, spots with printable QR codes, open tabs,
  recent payments.
- `app/api/webhooks/stripe` — `payment_intent.succeeded` marks the Payment
  row succeeded and calls the venue's adapter `markPaid()` to reconcile the
  tab; `account.updated` keeps onboarding status in sync.

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
