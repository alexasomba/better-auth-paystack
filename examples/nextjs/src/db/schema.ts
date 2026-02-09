import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// User table
export const user = sqliteTable("user", {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Session table
export const session = sqliteTable("session", {
    id: text("id").primaryKey().notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => ({
    userIdIdx: index("idx_session_userId").on(table.userId),
    tokenIdx: index("idx_session_token").on(table.token),
}));

// Account table (for OAuth providers)
export const account = sqliteTable("account", {
    id: text("id").primaryKey().notNull(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    userIdIdx: index("idx_account_userId").on(table.userId),
}));

// Verification table (for email verification, etc.)
export const verification = sqliteTable("verification", {
    id: text("id").primaryKey().notNull(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Subscription table (for paystack plugin)
export const subscription = sqliteTable("subscription", {
    id: text("id").primaryKey().notNull(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    planId: text("planId").notNull(),
    externalId: text("externalId"),
    status: text("status").notNull(),
    startsAt: integer("startsAt", { mode: "timestamp" }),
    endsAt: integer("endsAt", { mode: "timestamp" }),
    canceledAt: integer("canceledAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    userIdIdx: index("idx_subscription_userId").on(table.userId),
}));

// Paystack Transaction table
export const paystackTransaction = sqliteTable("paystackTransaction", {
    id: text("id").primaryKey().notNull(),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    reference: text("reference").notNull().unique(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    metadata: text("metadata"),
    paidAt: integer("paidAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    userIdIdx: index("idx_paystackTransaction_userId").on(table.userId),
    referenceIdx: index("idx_paystackTransaction_reference").on(table.reference),
}));
