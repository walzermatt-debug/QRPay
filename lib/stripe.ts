import Stripe from "stripe";

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  // No apiVersion pin: let the installed stripe-node SDK use the version it
  // was built against, so we stay current without hand-tracking Stripe's
  // release calendar here.
  return new Stripe(secretKey);
}

let client: Stripe | undefined;

// Constructed lazily, on first property access, rather than eagerly at
// module scope. Next.js's build-time "Collecting page data" step imports
// every route module — including ones that use Stripe — without runtime
// secrets necessarily available, so throwing here eagerly crashes `next
// build` entirely even for routes nothing to do with the request being
// built. Deferring construction means the build only needs the key once a
// request actually reaches a Stripe-using route.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!client) client = createStripeClient();
    return Reflect.get(client, prop, receiver);
  },
});
