import fs from "node:fs";
let code = fs.readFileSync("src/routes.ts", "utf-8");
code = code.replace(
	/let updatedSubscription: Subscription \| null = null;/,
	`let updatedSubscription: Subscription | null = null;\n\t\t\t\t\tconsole.log("DEBUG UPDATE PAYLOAD:", { status: isTrial === true ? "trialing" : "active", isTrial, trialEnd });`
);
code = code.replace(
	/if \(updatedSubscription && subscriptionOptions\?\.enabled === true/,
	`console.log("DEBUG UPDATED RESULT:", updatedSubscription);\n\t\t\t\t\tif (updatedSubscription && subscriptionOptions?.enabled === true`
);
fs.writeFileSync("src/routes.ts", code);
