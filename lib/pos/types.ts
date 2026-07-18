// The POS abstraction boundary.
//
// Venues either run entirely on Venue Pay (no external order system — the
// common case at launch, especially for beach clubs and small restaurants
// that currently run tabs on paper) or on a real POS (Square, Toast,
// Lightspeed, ...) that owns orders/tabs as the source of truth.
//
// Everything outside lib/pos/ — API routes, the staff order-entry screen,
// the customer pay page, the webhook reconciliation handler, the operator
// dashboard — talks exclusively to the POSAdapter interface below, obtained
// through getPOSAdapter() in factory.ts. No other module may import a
// specific adapter (InternalAdapter, SquareAdapter, ...) directly, and no
// other module may reference a POS vendor by name.

export type POSTabStatus =
  | "open"
  | "partially_paid"
  | "paid"
  | "closed"
  | "void";

export interface POSLineItem {
  id: string;
  name: string;
  quantity: number;
  /** Minor currency units (e.g. cents), matching Stripe's convention. */
  unitPrice: number;
  /**
   * True once a "choose items" payment has claimed this line (whole line,
   * not sub-divisible by quantity). Locked items are excluded from what's
   * offered to the next scanner.
   */
  paid: boolean;
}

export interface POSTab {
  /** Venue Pay's own tab id (always present — we track every tab we reconcile). */
  id: string;
  /** The id of this tab/check in the source POS, if the source is external. */
  externalId: string | null;
  spotLabel: string;
  status: POSTabStatus;
  /** ISO 4217 lowercase currency code. */
  currency: string;
  lineItems: POSLineItem[];
  /** Sum of quantity * unitPrice across lineItems, in minor units. */
  subtotal: number;
  /**
   * subtotal minus the amount covered by all succeeded payments so far
   * (regardless of split mode). What "split evenly" divides — it shrinks
   * as people pay, so whoever scans next just enters how many people are
   * left and splits what's actually still owed.
   */
  remainingSubtotal: number;
  createdAt: Date;
}

export interface NewLineItemInput {
  name: string;
  quantity: number;
  /** Minor currency units. */
  unitPrice: number;
}

export interface MarkPaidInput {
  /** The POS's identifier for the tab being reconciled. */
  externalId: string;
  /** Amount of the bill (excluding tip and platform fee) this payment covered, in minor units. */
  amountPaid: number;
  /** Tip amount for this payment, in minor units. */
  tipAmount: number;
  /** Venue Pay's own Payment id, so specific line items can be linked to it. */
  paymentId: string;
  /**
   * Set only when the payer used "choose items" mode — the specific line
   * items this payment covers, which should be locked to it. Omitted for
   * an even-split payment, since that doesn't correspond to specific items.
   */
  lineItemIds?: string[];
}

/**
 * Every method is scoped to a single venue and never leaks another venue's
 * data — callers pass venueId on every call rather than binding it once, so
 * adapter instances stay stateless and cheap to construct per-request.
 */
export interface POSAdapter {
  /** All tabs currently open (or partially paid) for the venue. */
  listOpenTabs(venueId: string): Promise<POSTab[]>;

  /** The open tab for a given spot (table/lounger/cabana), if any. */
  getTab(venueId: string, spotLabel: string): Promise<POSTab | null>;

  /**
   * Opens a tab for the spot if none is open, or appends items to the
   * existing one. This is the staff order-entry write path.
   *
   * POS-backed venues treat their POS as the order system of record, so
   * adapters for a real POS are expected to reject this (throw) rather than
   * silently write around the POS — staff should key orders into the POS
   * itself. Only InternalAdapter (and any future adapter without a
   * connected order system) implements this as a real write.
   */
  addLineItems(
    venueId: string,
    spotLabel: string,
    items: NewLineItemInput[],
  ): Promise<POSTab>;

  /**
   * Reconciles a successful payment against the source POS: marks the tab
   * paid (fully or partially) so it drops off — or updates its status on —
   * listOpenTabs / getTab.
   */
  markPaid(venueId: string, input: MarkPaidInput): Promise<void>;
}
