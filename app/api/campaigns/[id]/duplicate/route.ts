import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { campaigns } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const original = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.teamId, session.teamId)),
  });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [copy] = await db
    .insert(campaigns)
    .values({
      teamId: session.teamId,
      wabaAccountId: original.wabaAccountId,
      templateId: original.templateId,
      listId: original.listId,
      name: `${original.name} (copy)`,
      variableMapping: original.variableMapping,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ campaign: copy });
}
