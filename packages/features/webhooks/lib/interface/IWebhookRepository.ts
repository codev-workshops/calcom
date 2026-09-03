import type { UserPermissionRole, WebhookTriggerEvents } from "@calcom/prisma/enums";
import type { WebhookVersion } from "@calcom/types/WebhookVersion";

import type { Webhook, WebhookGroup, WebhookSubscriber } from "../dto/types";

export {
  DEFAULT_WEBHOOK_VERSION,
  isValidWebhookVersion,
  parseWebhookVersion,
  WebhookVersion,
} from "@calcom/types/WebhookVersion";

export interface GetSubscribersOptions {
  userId?: number | null;
  eventTypeId?: number | null;
  triggerEvent: WebhookTriggerEvents;
  teamId?: number | number[] | null;
  orgId?: number | null;
  oAuthClientId?: string | null;
}

export interface ListWebhooksOptions {
  userId: number;
  appId?: string | null;
  eventTypeId?: number | null;
  eventTriggers?: WebhookTriggerEvents[];
}

export interface IWebhookRepository {
  getSubscribers(options: GetSubscribersOptions): Promise<WebhookSubscriber[]>;
  getWebhookById(id: string): Promise<WebhookSubscriber | null>;
  findByWebhookId(webhookId?: string): Promise<{
    id: string;
    subscriberUrl: string;
    payloadTemplate: string | null;
    active: boolean;
    eventTriggers: WebhookTriggerEvents[];
    secret: string | null;
    teamId: number | null;
    userId: number | null;
    platform: boolean;
    time: number | null;
    timeUnit: string | null;
    version: WebhookVersion;
  }>;
  getFilteredWebhooksForUser(options: { userId: number; userRole?: UserPermissionRole }): Promise<{
    webhookGroups: WebhookGroup[];
    profiles: {
      teamId: number | null | undefined;
      slug: string | null;
      name: string | null;
      image?: string | undefined;
      canModify?: boolean;
      canDelete?: boolean;
    }[];
  }>;
  listWebhooks(options: ListWebhooksOptions): Promise<Webhook[]>;
}
