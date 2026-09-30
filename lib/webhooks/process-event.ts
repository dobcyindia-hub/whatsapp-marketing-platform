import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { campaigns, campaignRecipients, contacts, messageEvents, wabaAccounts } from "@/database/schema";
import { fireKeywordReplyAutomations } from "@/lib/automations/engine";
import type { MetaWebhookPayload, MetaStatusUpdate, MetaInboundMessage } from "./types";

// Exact-match, case-insensitive — a message that just says one of these
// words auto-opts the sender out, per WhatsApp's own opt-out conventions.
const OPT_OUT_KEYWORDS = new Set(["stop", "unsubscribe", "opt out", "optout", "cancel"]);

async function findWabaAccount(phoneNumberId: string) {
  return db.query.wabaAccounts.findFirst({ where: eq(wabaAccounts.phoneNumberId, phoneNumberId) });
}

async function handleStatusUpdate(
  status: MetaStatusUpdate,
  wabaAccount: NonNullable<Awaited<ReturnType<typeof findWabaAccount>>>
) {
  const recipient = await db.query.campaignRecipients.findFirst({
    where: eq(campaignRecipients.metaMessageId, status.id),
    with: { campaign: true },
  });

  await db.insert(messageEvents).values({
    teamId: wabaAccount.teamId,
    wabaAccountId: wabaAccount.id,
    contactId: recipient?.contactId ?? null,
    eventType: status.status,
    metaMessageId: status.id,
    rawPayload: status,
  });

  if (!recipient) return;
  const campaignId = recipient.campaignId;

  if (status.status === "delivered" && !recipient.deliveredAt) {
    await db
      .update(campaignRecipients)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(eq(campaignRecipients.id, recipient.id));
    await db
      .update(campaigns)
      .set({ deliveredCount: sql`${campaigns.deliveredCount} + 1` })
      .where(eq(campaigns.id, campaignId));
  } else if (status.status === "read" && !recipient.readAt) {
    await db
      .update(campaignRecipients)
      .set({ status: "read", readAt: new Date() })
      .where(eq(campaignRecipients.id, recipient.id));
    await db
      .update(campaigns)
      .set({ readCount: sql`${campaigns.readCount} + 1` })
      .where(eq(campaigns.id, campaignId));
  } else if (status.status === "failed" && recipient.status !== "failed") {
    const error = status.errors?.[0];
    await db
      .update(campaignRecipients)
      .set({
        status: "failed",
        errorMessage: error?.message ?? error?.title ?? "Delivery failed",
        errorCode: error ? String(error.code) : undefined,
      })
      .where(eq(campaignRecipients.id, recipient.id));
    await db
      .update(campaigns)
      .set({ failedCount: sql`${campaigns.failedCount} + 1` })
      .where(eq(campaigns.id, campaignId));
  }
}

async function handleInboundMessage(
  message: MetaInboundMessage,
  wabaAccount: NonNullable<Awaited<ReturnType<typeof findWabaAccount>>>,
  senderName?: string
) {
  const candidates = [message.from, `+${message.from}`];
  let contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.teamId, wabaAccount.teamId), inArray(contacts.phone, candidates)),
  });

  // Anyone who messages this number for the first time becomes a contact —
  // otherwise inbound messages from new senders were silently dropped and
  // never showed up anywhere in the dashboard.
  if (!contact) {
    const [created] = await db
      .insert(contacts)
      .values({
        teamId: wabaAccount.teamId,
        phone: `+${message.from}`,
        name: senderName || null,
        lastInboundAt: new Date(),
      })
      .returning();
    contact = created;
  }

  await db.insert(messageEvents).values({
    teamId: wabaAccount.teamId,
    wabaAccountId: wabaAccount.id,
    contactId: contact.id,
    eventType: "inbound",
    metaMessageId: message.id,
    rawPayload: message,
  });

  await db.update(contacts).set({ lastInboundAt: new Date() }).where(eq(contacts.id, contact.id));

  const bodyText = message.text?.body?.trim().toLowerCase();
  if (bodyText && OPT_OUT_KEYWORDS.has(bodyText)) {
    await db.update(contacts).set({ optedOut: true, optedOutAt: new Date() }).where(eq(contacts.id, contact.id));
  }

  if (message.text?.body) {
    await fireKeywordReplyAutomations({
      teamId: wabaAccount.teamId,
      wabaAccountId: wabaAccount.id,
      contact,
      messageText: message.text.body,
    });
  }

  const recentRecipient = await db
    .select({ id: campaignRecipients.id, campaignId: campaignRecipients.campaignId })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(
      and(
        eq(campaignRecipients.contactId, contact.id),
        eq(campaigns.wabaAccountId, wabaAccount.id),
        inArray(campaignRecipients.status, ["sent", "delivered", "read"]),
        isNull(campaignRecipients.repliedAt)
      )
    )
    .orderBy(desc(campaignRecipients.sentAt))
    .limit(1);

  const match = recentRecipient[0];
  if (!match) return;

  await db
    .update(campaignRecipients)
    .set({ status: "replied", repliedAt: new Date() })
    .where(eq(campaignRecipients.id, match.id));
  await db
    .update(campaigns)
    .set({ repliedCount: sql`${campaigns.repliedCount} + 1` })
    .where(eq(campaigns.id, match.campaignId));
}

export async function processWebhookPayload(payload: MetaWebhookPayload) {
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const wabaAccount = await findWabaAccount(value.metadata.phone_number_id);
      if (!wabaAccount) continue; // event for a number we don't have on file

      for (const status of value.statuses ?? []) {
        await handleStatusUpdate(status, wabaAccount);
      }
      for (const message of value.messages ?? []) {
        const senderName = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
        await handleInboundMessage(message, wabaAccount, senderName);
      }
    }
  }
}
