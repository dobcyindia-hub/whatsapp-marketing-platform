import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { campaigns, templates, contactLists } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.campaigns.findMany({
    where: eq(campaigns.teamId, session.teamId),
    orderBy: desc(campaigns.createdAt),
    with: { template: { columns: { name: true } }, list: { columns: { name: true } } },
  });

  return NextResponse.json({ campaigns: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  wabaAccountId: z.string().uuid(),
  templateId: z.string().uuid(),
  listId: z.string().uuid(),
  variableMapping: z.record(z.string(), z.string()).default({}),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, wabaAccountId, templateId, listId, variableMapping, scheduledAt } = parsed.data;

  const template = await db.query.templates.findFirst({
    where: and(eq(templates.id, templateId), eq(templates.teamId, session.teamId)),
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (template.status !== "approved") {
    return NextResponse.json({ error: "Only approved templates can be used in campaigns" }, { status: 422 });
  }

  const list = await db.query.contactLists.findFirst({
    where: and(eq(contactLists.id, listId), eq(contactLists.teamId, session.teamId)),
  });
  if (!list) return NextResponse.json({ error: "Contact list not found" }, { status: 404 });

  const [campaign] = await db
    .insert(campaigns)
    .values({
      teamId: session.teamId,
      wabaAccountId,
      templateId,
      listId,
      name,
      variableMapping,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ campaign });
}
