import crypto from "crypto";

export const DEVELOPER_KEY_PREFIX = "pfc_live_";

export function hashDeveloperApiKeySecret(secret: string): string {
  return crypto.createHash("sha256").update(secret, "utf8").digest("hex");
}

export function newDeveloperKeyDisplayPrefix(): string {
  return `${DEVELOPER_KEY_PREFIX}${crypto.randomBytes(4).toString("hex")}`;
}

export function newPendingDeveloperKeyPrefix(): string {
  return `pfc_req_${crypto.randomBytes(4).toString("hex")}`;
}

export function generateDeveloperApiKeyPlaintext(): string {
  return `${DEVELOPER_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

export function buildNewDeveloperKeyCredentials(): {
  secret: string;
  prefix: string;
  secretHash: string;
} {
  const secret = generateDeveloperApiKeyPlaintext();
  return {
    secret,
    prefix: newDeveloperKeyDisplayPrefix(),
    secretHash: hashDeveloperApiKeySecret(secret),
  };
}

export function isSupportedDeveloperApiKeySecretFormat(secret: string): boolean {
  return secret.startsWith(DEVELOPER_KEY_PREFIX);
}