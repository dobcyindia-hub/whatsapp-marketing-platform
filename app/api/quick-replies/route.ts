import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quickReplies } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.quickReplies.findMany({
    where: eq(quickReplies.teamId, session.teamId),
    orderBy: desc(quickReplies.createdAt),
  });
  return NextResponse.json({ quickReplies: rows });
}

const createSchema = z.object({
  title: z.string().min(1).max(100),
  bodyText: z.string().min(1).max(4096),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [row] = await db
    .insert(quickReplies)
    .values({ teamId: session.teamId, title: parsed.data.title, bodyText: parsed.data.bodyText })
    .returning();
  return NextResponse.json({ quickReply: row });
}
