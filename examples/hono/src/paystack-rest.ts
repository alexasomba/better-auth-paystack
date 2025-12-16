type PaystackApiResponse<T> = {
    status: boolean;
    message: string;
    data: T;
};

export function createPaystackRestClient(secretKey: string) {
    const baseURL = "https://api.paystack.co";

    const request = async <T>(path: string, init: RequestInit) => {
        const res = await fetch(`${baseURL}${path}`, {
            ...init,
            headers: {
                authorization: `Bearer ${secretKey}`,
                "content-type": "application/json",
                ...(init.headers ?? {}),
            },
        });

        const json = (await res.json()) as PaystackApiResponse<T>;
        return { data: json };
    };

    return {
        customer_create: (init?: { body?: any } | undefined) =>
            request("/customer", {
                method: "POST",
                body: init?.body ? JSON.stringify(init.body) : undefined,
            }),

        transaction_initialize: (init?: { body?: any } | undefined) =>
            request("/transaction/initialize", {
                method: "POST",
                body: init?.body ? JSON.stringify(init.body) : undefined,
            }),

        transaction_verify: ({ params }: { params: { path: { reference: string } } }) =>
            request(`/transaction/verify/${params.path.reference}`, {
                method: "GET",
            }),

        subscription_disable: (init?: { body?: { code: string; token: string } } | undefined) =>
            request("/subscription/disable", {
                method: "POST",
                body: init?.body ? JSON.stringify(init.body) : undefined,
            }),

        subscription_enable: (init?: { body?: { code: string; token: string } } | undefined) =>
            request("/subscription/enable", {
                method: "POST",
                body: init?.body ? JSON.stringify(init.body) : undefined,
            }),

        subscription_fetch: ({
            params,
        }: {
            params: { path: { code?: string; id_or_code?: string } };
        }) => {
            const code = params.path.code ?? params.path.id_or_code;
            return request(`/subscription/${code}`, { method: "GET" });
        },

        subscription_manage_link: ({ params }: { params: { path: { code: string } } }) =>
            request(`/subscription/${params.path.code}/manage/link`, {
                method: "GET",
            }),
    };
}
