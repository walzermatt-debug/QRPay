import type {
  MarkPaidInput,
  NewLineItemInput,
  POSAdapter,
  POSTab,
} from "./types";

// STUB — not implemented. Square is the right first real POS integration
// (self-serve API + OAuth, no partner-approval gate like Toast requires),
// but no venue should be configured with posSource: "square" until this is
// built out for real.
//
// Shape of the work when we get here:
//   - Auth: OAuth per venue, storing { accessToken, refreshToken,
//     merchantId, locationId } in Venue.posConfig (encrypted at rest).
//   - listOpenTabs: Square Orders API, search open orders for the venue's
//     location(s), map Square line items -> POSLineItem.
//   - getTab: same search, filtered by table/lounger label — Square doesn't
//     have a native "spot" concept, so this likely maps to an order
//     fulfillment note or a custom attribute set when the order is opened.
//   - addLineItems: Square is the order system of record for these venues,
//     so this should stay unimplemented/rejected — staff key orders into
//     Square directly, not through Venue Pay.
//   - markPaid: Square Payments/Orders API to record the tender against the
//     order so it reflects paid status back in Square, keeping Square as
//     the single source of truth.
//
// See lib/pos/types.ts for the full interface contract this must satisfy,
// and lib/pos/factory.ts for how a venue gets routed here.
export class SquareAdapter implements POSAdapter {
  async listOpenTabs(_venueId: string): Promise<POSTab[]> {
    throw new Error("SquareAdapter.listOpenTabs is not implemented yet");
  }

  async getTab(_venueId: string, _spotLabel: string): Promise<POSTab | null> {
    throw new Error("SquareAdapter.getTab is not implemented yet");
  }

  async addLineItems(
    _venueId: string,
    _spotLabel: string,
    _items: NewLineItemInput[],
  ): Promise<POSTab> {
    throw new Error(
      "SquareAdapter.addLineItems is not supported: Square-backed venues " +
        "key orders into Square directly, not through Venue Pay.",
    );
  }

  async markPaid(_venueId: string, _input: MarkPaidInput): Promise<void> {
    throw new Error("SquareAdapter.markPaid is not implemented yet");
  }
}
