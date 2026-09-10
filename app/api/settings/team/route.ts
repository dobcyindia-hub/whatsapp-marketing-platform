import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { teams } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

const schema = z.object({ name: z.string().min(1).max(255) });

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [team] = await db
    .update(teams)
    .set({ name: parsed.data.name })
    .where(eq(teams.id, session.teamId))
    .returning();

  return NextResponse.json({ team });
}
