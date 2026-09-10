import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [deleted] = await db
    .delete(wabaAccounts)
    .where(and(eq(wabaAccounts.id, id), eq(wabaAccounts.teamId, session.teamId)))
    .returning({ id: wabaAccounts.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
