import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contactLists, contactListMembers } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

const addMembersSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = addMembersSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const list = await db.query.contactLists.findFirst({
    where: and(eq(contactLists.id, id), eq(contactLists.teamId, session.teamId)),
  });
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  await db
    .insert(contactListMembers)
    .values(parsed.data.contactIds.map((contactId) => ({ listId: id, contactId })))
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, added: parsed.data.contactIds.length });
}
