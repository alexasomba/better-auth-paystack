export const getOrganizationSubscription = async (ctx, organizationId) => {
    const subscription = await ctx.context.adapter.findOne({
        model: "subscription",
        where: [{ field: "referenceId", value: organizationId }],
    });
    return subscription;
};
export const checkSeatLimit = async (ctx, organizationId, seatsToAdd = 1) => {
    const subscription = await getOrganizationSubscription(ctx, organizationId);
    // If no subscription or no seats defined, we assume no limit or fallback to default
    // For this implementation, let's say if no seats defined, it is unlimited or strictly limited 
    // depending on requirement. Usually unlimited if not specified, OR 1.
    // Let's assume if 'seats' is present, it's the limit.
    if (subscription?.seats === undefined || subscription.seats === null) {
        return true; // No explicit seat limit found
    }
    const members = await ctx.context.adapter.findMany({
        model: "member",
        where: [{ field: "organizationId", value: organizationId }],
    });
    if (members.length + seatsToAdd > subscription.seats) {
        throw new Error(`Organization member limit reached. Used: ${members.length}, Max: ${subscription.seats}`);
    }
    return true;
};
export const checkTeamLimit = async (ctx, organizationId, maxTeams) => {
    const teams = await ctx.context.adapter.findMany({
        model: "team",
        where: [{ field: "organizationId", value: organizationId }],
    });
    if (teams.length >= maxTeams) {
        throw new Error(`Organization team limit reached. Max teams: ${maxTeams}`);
    }
    return true;
};
