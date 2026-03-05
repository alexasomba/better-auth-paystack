import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";

import type { Subscription } from "./types";

export const getOrganizationSubscription = async (
	ctx: GenericEndpointContext,
	organizationId: string
): Promise<Subscription | null> => {
	const subscription = await ctx.context.adapter.findOne<Subscription>({
		model: "subscription",
		where: [{ field: "referenceId", value: organizationId }],
	});
	return subscription;
};

export const checkSeatLimit = async (
	ctx: GenericEndpointContext,
	organizationId: string,
	seatsToAdd = 1
) => {
	const subscription = await getOrganizationSubscription(ctx, organizationId);
    
	if (subscription?.seats === undefined || subscription.seats === null) {
		return true; // No explicit seat limit found
	}

	const members = await ctx.context.adapter.findMany({
		model: "member",
		where: [{ field: "organizationId", value: organizationId }],
	});

	if (members.length + seatsToAdd > subscription.seats) {
		throw new APIError("FORBIDDEN", {
			message: `Organization member limit reached. Used: ${members.length}, Max: ${subscription.seats}`
		});
	}

	return true;
};

export const checkTeamLimit = async (
	ctx: GenericEndpointContext,
	organizationId: string,
	maxTeams: number
) => {
	const teams = await ctx.context.adapter.findMany({
		model: "team",
		where: [{ field: "organizationId", value: organizationId }],
	});

	if (teams.length >= maxTeams) {
		throw new APIError("FORBIDDEN", {
			message: `Organization team limit reached. Max teams: ${maxTeams}`
		});
	}

	return true;
};
