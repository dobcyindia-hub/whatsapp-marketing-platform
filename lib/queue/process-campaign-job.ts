import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { campaignRecipients, campaigns, contacts } from "@/database/schema";
import { decryptSecret } from "@/lib/crypto";
import { GraphApiError, sendTemplateMessage } from "@/lib/whatsapp/graph-client";
import { resolveVariablesForContact } from "@/lib/whatsapp/template-utils";

export type ProcessResult = {
  outcome: "sent" | "skipped_opted_out" | "retry" | "failed";
  error?: string;
};

async function maybeCompleteCampaign(campaignId: string) {
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!campaign || campaign.status !== "sending") return;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        inArray(campaignRecipients.status, ["pending", "queued"])
      )
    );

  if (count === 0) {
    await db
      .update(campaigns)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }
}

export async function processCampaignRecipient(
  recipientId: string,
  attemptsMade: number,
  maxAttempts: number
): Promise<ProcessResult> {
  const recipient = await db.query.campaignRecipients.findFirst({
    where: eq(campaignRecipients.id, recipientId),
    with: {
      contact: true,
      campaign: { with: { template: true, wabaAccount: true } },
    },
  });

  if (!recipient) return { outcome: "failed", error: "Recipient record not found" };
  if (recipient.status !== "pending" && recipient.status !== "queued") {
    return { outcome: "sent" }; // already processed (retry after partial completion)
  }

  const { contact, campaign } = recipient;
  const { template, wabaAccount } = campaign;

  if (campaign.status === "scheduled") {
    await db
      .update(campaigns)
      .set({ status: "sending", startedAt: new Date() })
      .where(eq(campaigns.id, campaign.id));
  }

  if (contact.optedOut) {
    await db
      .update(campaignRecipients)
      .set({ status: "skipped_opted_out" })
      .where(eq(campaignRecipients.id, recipientId));
    await maybeCompleteCampaign(campaign.id);
    return { outcome: "skipped_opted_out" };
  }

  const bodyParams = resolveVariablesForContact(template.variableCount, campaign.variableMapping ?? {}, {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
  });

  try {
    const accessToken = decryptSecret(wabaAccount.accessTokenEncrypted);
    const result = await sendTemplateMessage({
      phoneNumberId: wabaAccount.phoneNumberId,
      accessToken,
      to: contact.phone,
      templateName: template.name,
      languageCode: template.language,
      bodyParams,
    });

    await db
      .update(campaignRecipients)
      .set({
        status: "sent",
        metaMessageId: result.messages?.[0]?.id ?? null,
        sentAt: new Date(),
      })
      .where(eq(campaignRecipients.id, recipientId));

    await db.update(contacts).set({ lastMessagedAt: new Date() }).where(eq(contacts.id, contact.id));

    await db
      .update(campaigns)
      .set({ sentCount: sql`${campaigns.sentCount} + 1` })
      .where(eq(campaigns.id, campaign.id));

    await maybeCompleteCampaign(campaign.id);
    return { outcome: "sent" };
  } catch (err) {
    const isLastAttempt = attemptsMade + 1 >= maxAttempts;
    const message = err instanceof GraphApiError ? err.message : "Failed to reach the Meta Graph API";
    const code = err instanceof GraphApiError ? String(err.code ?? "") : undefined;

    if (!isLastAttempt) {
      return { outcome: "retry", error: message };
    }

    await db
      .update(campaignRecipients)
      .set({ status: "failed", errorMessage: message, errorCode: code })
      .where(eq(campaignRecipients.id, recipientId));

    await db
      .update(campaigns)
      .set({ failedCount: sql`${campaigns.failedCount} + 1` })
      .where(eq(campaigns.id, campaign.id));

    await maybeCompleteCampaign(campaign.id);
    return { outcome: "failed", error: message };
  }
}
