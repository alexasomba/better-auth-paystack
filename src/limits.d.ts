import type { GenericEndpointContext } from "better-auth";
import type { Subscription } from "./types";
export declare const getOrganizationSubscription: (ctx: GenericEndpointContext, organizationId: string) => Promise<Subscription | null>;
export declare const checkSeatLimit: (ctx: GenericEndpointContext, organizationId: string, seatsToAdd?: number) => Promise<boolean>;
export declare const checkTeamLimit: (ctx: GenericEndpointContext, organizationId: string, maxTeams: number) => Promise<boolean>;
//# sourceMappingURL=limits.d.ts.map