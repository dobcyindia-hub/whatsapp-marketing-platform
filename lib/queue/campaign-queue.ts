import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const CAMPAIGN_QUEUE_NAME = "campaign-sends";

export type CampaignSendJobData = {
  campaignRecipientId: string;
};

const globalForQueue = globalThis as unknown as { _campaignQueue?: Queue<CampaignSendJobData> };

export const campaignQueue: Queue<CampaignSendJobData> =
  globalForQueue._campaignQueue ??
  new Queue<CampaignSendJobData>(CAMPAIGN_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForQueue._campaignQueue = campaignQueue;
}

export async function enqueueCampaignRecipient(recipientId: string, delayMs = 0) {
  await campaignQueue.add(
    "send",
    { campaignRecipientId: recipientId },
    { jobId: recipientId, delay: delayMs > 0 ? delayMs : undefined }
  );
}
