import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await db.query.wabaAccounts.findMany({
    where: eq(wabaAccounts.teamId, session.teamId),
    columns: {
      id: true,
      wabaId: true,
      phoneNumberId: true,
      displayPhoneNumber: true,
      displayName: true,
      status: true,
      messagingTier: true,
      webhookVerifyToken: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ accounts });
}
