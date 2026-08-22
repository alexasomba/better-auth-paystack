import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import { createBillingStore } from "./billing-store";
import type { AnyPaystackOptions, Subscription } from "./types";
import { getPlanByName } from "./utils";

export const getOrganizationSubscription = async (
  ctx: GenericEndpointContext,
  organizationId: string,
  groupId?: string | null,
): Promise<Subscription | null> => {
  return createBillingStore(ctx).findCurrentSubscription(organizationId, groupId);
};

export const checkSeatLimit = async (
  ctx: GenericEndpointContext,
  organizationId: string,
  seatsToAdd = 1,
): Promise<boolean> => {
  const store = createBillingStore(ctx);
  const subscriptions = (await store.findSubscriptionsByReference(organizationId)).filter(
    (subscription) => subscription.status === "active" || subscription.status === "trialing",
  );
  const seatLimit = subscriptions.reduce<number | undefined>(
    (maximum, subscription) =>
      typeof subscription.seats === "number"
        ? Math.max(maximum ?? subscription.seats, subscription.seats)
        : maximum,
    undefined,
  );
  const members = await store.listMembers(organizationId);

  if (seatLimit === undefined) {
    return true; // No subscription, no specific limit enforcement here (or maybe allow depending on config)
  }

  if (members.length + seatsToAdd > seatLimit) {
    throw new APIError("FORBIDDEN", {
      message: `Organization member limit reached. Used: ${members.length}, Max: ${seatLimit}`,
    });
  }

  return true;
};

export async function getOrganizationEntitlements(
  ctx: GenericEndpointContext,
  organizationId: string,
  options: AnyPaystackOptions,
): Promise<{ limits: Record<string, number>; features: string[] }> {
  const subscriptions = (
    await createBillingStore(ctx).findSubscriptionsByReference(organizationId)
  ).filter(
    (subscription) => subscription.status === "active" || subscription.status === "trialing",
  );
  const limits: Record<string, number> = {};
  const features = new Set<string>();
  for (const subscription of subscriptions) {
    const plan = await getPlanByName(options, subscription.plan);
    for (const [name, value] of Object.entries(plan?.limits ?? {})) {
      if (typeof value === "number" && Number.isFinite(value)) {
        limits[name] = Math.max(limits[name] ?? value, value);
      }
    }
    for (const feature of plan?.features ?? []) features.add(feature);
  }
  return { limits, features: [...features] };
}

export const checkTeamLimit = async (
  ctx: GenericEndpointContext,
  organizationId: string,
  maxTeams: number,
): Promise<boolean> => {
  const teams = await createBillingStore(ctx).listTeams(organizationId);

  if (teams.length >= maxTeams) {
    throw new APIError("FORBIDDEN", {
      message: `Organization team limit reached. Max teams: ${maxTeams}`,
    });
  }

  return true;
};
