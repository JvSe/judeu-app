import { env } from "@judeu/env/server";
import Stripe from "stripe";

if (!env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY não configurada (.env)");
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
