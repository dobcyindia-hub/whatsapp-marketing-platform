import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { contacts, messageEvents } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, asc, eq } from "drizzle-orm";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await params;

  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.teamId, session.teamId)),
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db.query.messageEvents.findMany({
    where: and(eq(messageEvents.teamId, session.teamId), eq(messageEvents.contactId, contactId)),
    orderBy: asc(messageEvents.createdAt),
  });

  return NextResponse.json({ contact, events });
}
