import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { campaigns, campaignRecipients } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq, inArray } from "drizzle-orm";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.teamId, session.teamId)),
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["scheduled", "sending"].includes(campaign.status)) {
    return NextResponse.json({ error: "Only a scheduled or in-progress campaign can be cancelled" }, { status: 422 });
  }

  // Any job for a recipient not still pending/queued is a no-op when the
  // worker picks it up (it only processes pending/queued rows), so this is
  // safe even for jobs already sitting in the queue.
  const cancelled = await db
    .update(campaignRecipients)
    .set({ status: "cancelled" })
    .where(and(eq(campaignRecipients.campaignId, id), inArray(campaignRecipients.status, ["pending", "queued"])))
    .returning({ id: campaignRecipients.id });

  await db.update(campaigns).set({ status: "cancelled", completedAt: new Date() }).where(eq(campaigns.id, id));

  return NextResponse.json({ ok: true, cancelledCount: cancelled.length });
}
