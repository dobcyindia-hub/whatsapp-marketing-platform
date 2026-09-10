import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contactLists, contactListMembers } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: contactLists.id,
      name: contactLists.name,
      description: contactLists.description,
      createdAt: contactLists.createdAt,
      memberCount: sql<number>`count(${contactListMembers.id})::int`,
    })
    .from(contactLists)
    .leftJoin(contactListMembers, eq(contactListMembers.listId, contactLists.id))
    .where(eq(contactLists.teamId, session.teamId))
    .groupBy(contactLists.id)
    .orderBy(contactLists.createdAt);

  return NextResponse.json({ lists: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [list] = await db
    .insert(contactLists)
    .values({ teamId: session.teamId, name: parsed.data.name, description: parsed.data.description })
    .returning();

  return NextResponse.json({ list: { ...list, memberCount: 0 } });
}
