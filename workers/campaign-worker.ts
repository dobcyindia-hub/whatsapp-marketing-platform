import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { Worker } = await import("bullmq");
  const { redisConnection } = await import("../lib/queue/redis");
  const { CAMPAIGN_QUEUE_NAME } = await import("../lib/queue/campaign-queue");
  const { processCampaignRecipient } = await import("../lib/queue/process-campaign-job");

  type CampaignSendJobData = { campaignRecipientId: string };

  // Meta's Cloud API rate-limits sends per phone number (messaging tier).
  // This is a conservative default queue-wide throughput cap; tune with
  // RATE_LIMIT_PER_SECOND once you know your number's tier.
  const RATE_LIMIT_PER_SECOND = Number(process.env.RATE_LIMIT_PER_SECOND ?? 10);
  const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

  const worker = new Worker<CampaignSendJobData>(
    CAMPAIGN_QUEUE_NAME,
    async (job) => {
      const maxAttempts = job.opts.attempts ?? 1;
      const result = await processCampaignRecipient(job.data.campaignRecipientId, job.attemptsMade, maxAttempts);
      if (result.outcome === "retry") {
        throw new Error(result.error ?? "Transient send failure");
      }
      return result;
    },
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
      limiter: { max: RATE_LIMIT_PER_SECOND, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[campaign-worker] sent recipient ${job.data.campaignRecipientId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[campaign-worker] recipient ${job?.data.campaignRecipientId} failed: ${err.message}`);
  });

  console.log(
    `[campaign-worker] listening on "${CAMPAIGN_QUEUE_NAME}" (concurrency=${CONCURRENCY}, rate=${RATE_LIMIT_PER_SECOND}/s)`
  );

  process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[campaign-worker] fatal startup error", err);
  process.exit(1);
});
