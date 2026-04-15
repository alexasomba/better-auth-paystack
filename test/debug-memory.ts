import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

import { paystack } from "../src/index";

async function run() {
  const auth = betterAuth({
    databaseHooks: {},

    plugins: [paystack({ paystackWebhookSecret: "test", paystackClient: {} as any })],
    databaseConfig: { adapter: memoryAdapter({}) },
  });
  const ctx = await auth.$context;

  const subRecord = await ctx.adapter.create({
    model: "subscription",
    data: {
      plan: "local-basic",
      referenceId: "user_123",
      status: "incomplete",
      paystackTransactionReference: "ref_local_123",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  // oxlint-disable-next-line no-console
  console.log("Created:", subRecord);

  const updated = await ctx.adapter.update({
    model: "subscription",
    update: { status: "active" },
    where: [{ field: "paystackTransactionReference", value: "ref_local_123" }],
  });
  // oxlint-disable-next-line no-console
  console.log("Updated returned:", updated);

  const check = await ctx.adapter.findOne<any>({
    model: "subscription",
    where: [{ field: "id", value: subRecord.id }],
  });
  // oxlint-disable-next-line no-console
  console.log("Final check:", check?.status);
}

run().catch(console.error);
