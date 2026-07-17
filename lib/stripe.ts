import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

// No apiVersion pin: let the installed stripe-node SDK use the version it
// was built against, so we stay current without hand-tracking Stripe's
// release calendar here.
export const stripe = new Stripe(secretKey);
