import { getPaystackOps } from "../src/paystack-sdk";
const paystackSdk = {
	subscription_fetch: (...args: any[]) => {
		console.log("Called with:", args);
		return Promise.resolve({ data: { email_token: "test" } });
	},
};
const paystack = getPaystackOps(paystackSdk as any);
paystack
	.subscriptionFetch("SUB_test")
	.then((res) => console.log("Result:", res))
	.catch((e) => console.error(e));
