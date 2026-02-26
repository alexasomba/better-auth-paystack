import { unwrapSdkResult } from '../src/paystack-sdk';
const mock = {
	data: {
		status: true,
		message: "ok",
		data: {
			email_token: "tok_test_123",
			next_payment_date: "..."
		},
	},
};
console.log("Mock Payload:", JSON.stringify(mock));
const fetchRes = unwrapSdkResult(mock);
console.log("fetchRes =", JSON.stringify(fetchRes));
const data = (fetchRes as any)?.data ?? fetchRes;
console.log("data =", JSON.stringify(data));
const finalData = (data)?.data ?? data;
console.log("finalData =", JSON.stringify(finalData));
