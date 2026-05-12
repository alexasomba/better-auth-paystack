import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import type { Subscription } from "./types";
import { createBillingStore } from "./billing-store";

export const getOrganizationSubscription = async (
  ctx: GenericEndpointContext,
  organizationId: string,
): Promise<Subscription | null> => {
  return createBillingStore(ctx).findCurrentSubscription(organizationId);
};

export const checkSeatLimit = async (
  ctx: GenericEndpointContext,
  organizationId: string,
  seatsToAdd = 1,
): Promise<boolean> => {
  const subscription = await getOrganizationSubscription(ctx, organizationId);

  if (subscription?.seats === null) {
    return true; // No explicit seat limit found
  }

  const members = await createBillingStore(ctx).listMembers(organizationId);

  if (!subscription) {
    return true; // No subscription, no specific limit enforcement here (or maybe allow depending on config)
  }

  if (members.length + seatsToAdd > subscription.seats) {
    throw new APIError("FORBIDDEN", {
      message: `Organization member limit reached. Used: ${members.length}, Max: ${subscription.seats}`,
    });
  }

  return true;
};

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
