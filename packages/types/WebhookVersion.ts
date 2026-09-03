/**
 * Webhook Version enum - defines the payload format versions.
 *
 * This is a TypeScript-only enum (not Prisma).
 * DB operations go through the repository which enforces these values.
 */
const WebhookVersion = {
  V_2021_10_20: "2021-10-20",
} as const;

type WebhookVersion = (typeof WebhookVersion)[keyof typeof WebhookVersion];

/**
 * Default webhook version - used for new webhooks and as fallback
 */
const DEFAULT_WEBHOOK_VERSION: WebhookVersion = WebhookVersion.V_2021_10_20;

const VALID_WEBHOOK_VERSIONS: Set<string> = new Set<string>(Object.values(WebhookVersion));

function isValidWebhookVersion(value: string): value is WebhookVersion {
  return VALID_WEBHOOK_VERSIONS.has(value);
}

/**
 * Parse and validate a webhook version string.
 * Throws if the version is invalid.
 */
function parseWebhookVersion(value: string): WebhookVersion {
  if (!isValidWebhookVersion(value)) {
    throw new Error(
      `Invalid webhook version: "${value}". Valid versions are: ${Object.values(WebhookVersion).join(", ")}`
    );
  }
  return value;
}

export { DEFAULT_WEBHOOK_VERSION, isValidWebhookVersion, parseWebhookVersion, WebhookVersion };
