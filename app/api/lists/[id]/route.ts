import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { contactLists } from "@/database/schema";
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
    .delete(contactLists)
    .where(and(eq(contactLists.id, id), eq(contactLists.teamId, session.teamId)))
    .returning({ id: contactLists.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
