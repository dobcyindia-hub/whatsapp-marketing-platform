import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { campaigns, campaignRecipients, contactListMembers } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { enqueueCampaignRecipient } from "@/lib/queue/campaign-queue";
import { and, eq } from "drizzle-orm";

const sendSchema = z.object({
  // Skip contacts messaged within the last N days, to avoid re-hitting the
  // same people back-to-back across campaigns.
  skipRecentlyMessagedDays: z.number().min(0).max(365).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(body);
  const skipRecentlyMessagedDays = parsed.success ? parsed.data.skipRecentlyMessagedDays : undefined;

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.teamId, session.teamId)),
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "This campaign has already been sent" }, { status: 422 });
  }
  if (!campaign.listId) {
    return NextResponse.json({ error: "Campaign has no contact list" }, { status: 422 });
  }

  const members = await db.query.contactListMembers.findMany({
    where: eq(contactListMembers.listId, campaign.listId),
    with: { contact: { columns: { id: true, optedOut: true, lastMessagedAt: true } } },
  });

  const cutoff = skipRecentlyMessagedDays ? Date.now() - skipRecentlyMessagedDays * 24 * 60 * 60 * 1000 : null;
  const eligible = members.filter(
    (m) =>
      !m.contact.optedOut &&
      (cutoff === null || !m.contact.lastMessagedAt || m.contact.lastMessagedAt.getTime() < cutoff)
  );
  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No eligible contacts in this list (all opted out, or all excluded by the frequency cap)" },
      { status: 422 }
    );
  }

  const recipientRows = await db
    .insert(campaignRecipients)
    .values(eligible.map((m) => ({ campaignId: campaign.id, contactId: m.contact.id, status: "pending" as const })))
    .returning({ id: campaignRecipients.id });

  const now = Date.now();
  const scheduledAtMs = campaign.scheduledAt ? new Date(campaign.scheduledAt).getTime() : now;
  const delayMs = Math.max(0, scheduledAtMs - now);

  for (const row of recipientRows) {
    await enqueueCampaignRecipient(row.id, delayMs);
    await db.update(campaignRecipients).set({ status: "queued" }).where(eq(campaignRecipients.id, row.id));
  }

  await db
    .update(campaigns)
    .set({
      status: delayMs > 0 ? "scheduled" : "sending",
      totalRecipients: recipientRows.length,
      startedAt: delayMs > 0 ? null : new Date(),
    })
    .where(eq(campaigns.id, campaign.id));

  return NextResponse.json({ queued: recipientRows.length, scheduled: delayMs > 0 });
}
