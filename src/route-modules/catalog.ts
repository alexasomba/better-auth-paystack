import type { GenericEndpointContext } from "better-auth";

import { createBillingStore } from "../billing-store";
import type { AnyPaystackOptions, PaystackPlan, PaystackProduct } from "../types";
import { getPlans, getProducts } from "../utils";

export async function listStoredProducts(ctx: GenericEndpointContext): Promise<PaystackProduct[]> {
  return createBillingStore(ctx).listProducts();
}

export async function listStoredPlans(ctx: GenericEndpointContext): Promise<PaystackPlan[]> {
  return createBillingStore(ctx).listPlans();
}

export async function getConfiguredCatalog(options: AnyPaystackOptions): Promise<{
  plans: PaystackPlan[];
  products: PaystackProduct[];
}> {
  const plans = options.subscription?.enabled === true ? await getPlans(options.subscription) : [];
  const products = await getProducts(options.products);
  return { plans, products };
}
