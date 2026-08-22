import { Buffer as NodeBuffer } from "node:buffer";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;

function deriveKey(secret: string): Uint8Array {
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new Error("A non-empty credential encryption key is required");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptPaystackCredential(value: string, secret: string): string {
  if (value === "") throw new Error("Cannot encrypt an empty Paystack credential");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const ciphertext = NodeBuffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(
    ":",
  );
}

export function decryptPaystackCredential(encrypted: string, secret: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid Paystack credential ciphertext");
  }
  const [, ivHex, authTagHex, ciphertextHex] = parts;
  const iv = NodeBuffer.from(ivHex, "hex");
  const authTag = NodeBuffer.from(authTagHex, "hex");
  const ciphertext = NodeBuffer.from(ciphertextHex, "hex");
  if (iv.length !== IV_LENGTH || authTag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Invalid Paystack credential ciphertext");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv);
  decipher.setAuthTag(authTag);
  return NodeBuffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function resolveCredentialEncryptionKey(options: {
  secretKey: string;
  credentialEncryptionKey?: string;
}): string {
  const key = options.credentialEncryptionKey ?? options.secretKey;
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("credentialEncryptionKey or secretKey must be a non-empty string");
  }
  return key;
}
