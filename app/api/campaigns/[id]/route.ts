import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { campaigns } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.teamId, session.teamId)),
    with: {
      template: { columns: { name: true, bodyText: true } },
      list: { columns: { name: true } },
      recipients: { with: { contact: { columns: { name: true, phone: true } } } },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ campaign });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.teamId, session.teamId)),
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json({ error: "Only draft campaigns can be deleted" }, { status: 422 });
  }

  await db.delete(campaigns).where(eq(campaigns.id, id));
  return NextResponse.json({ ok: true });
}
