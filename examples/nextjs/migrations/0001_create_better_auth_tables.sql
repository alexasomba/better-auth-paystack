-- Better Auth schema for D1
-- Based on better-auth required tables

-- User table
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Session table
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY NOT NULL,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Account table (for OAuth providers)
CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Verification table (for email verification, etc.)
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY NOT NULL,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Subscription table (for paystack plugin)
CREATE TABLE IF NOT EXISTS subscription (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    planId TEXT NOT NULL,
    externalId TEXT,
    status TEXT NOT NULL,
    startsAt INTEGER,
    endsAt INTEGER,
    canceledAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Paystack Transaction table
CREATE TABLE IF NOT EXISTS paystackTransaction (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata TEXT,
    paidAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_subscription_userId ON subscription(userId);
CREATE INDEX IF NOT EXISTS idx_paystackTransaction_userId ON paystackTransaction(userId);
CREATE INDEX IF NOT EXISTS idx_paystackTransaction_reference ON paystackTransaction(reference);
