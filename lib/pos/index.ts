// Barrel export — this is the only module outside lib/pos/ that should be
// imported. It intentionally does not re-export InternalAdapter or
// SquareAdapter: obtain an adapter through getPOSAdapter(), never by
// importing a vendor's class directly.
export { getPOSAdapter, getPOSAdapterFor } from "./factory";
export type {
  POSAdapter,
  POSTab,
  POSTabStatus,
  POSLineItem,
  NewLineItemInput,
  MarkPaidInput,
} from "./types";
