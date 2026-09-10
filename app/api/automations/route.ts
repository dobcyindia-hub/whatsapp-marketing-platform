import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { automations, templates, wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.automations.findMany({
    where: eq(automations.teamId, session.teamId),
    orderBy: desc(automations.createdAt),
    with: { template: { columns: { name: true } }, wabaAccount: { columns: { displayName: true, displayPhoneNumber: true } } },
  });

  return NextResponse.json({ automations: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(255),
  wabaAccountId: z.string().uuid(),
  templateId: z.string().uuid(),
  trigger: z.enum(["contact_created", "keyword_reply", "opt_in"]),
  keyword: z.string().max(255).optional(),
  variableMapping: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, wabaAccountId, templateId, trigger, keyword, variableMapping } = parsed.data;

  if (trigger === "keyword_reply" && !keyword) {
    return NextResponse.json({ error: "A keyword is required for keyword-reply automations" }, { status: 400 });
  }

  const wabaAccount = await db.query.wabaAccounts.findFirst({
    where: and(eq(wabaAccounts.id, wabaAccountId), eq(wabaAccounts.teamId, session.teamId)),
  });
  if (!wabaAccount) return NextResponse.json({ error: "WhatsApp number not found" }, { status: 404 });

  const template = await db.query.templates.findFirst({
    where: and(eq(templates.id, templateId), eq(templates.teamId, session.teamId)),
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (template.status !== "approved") {
    return NextResponse.json({ error: "Only approved templates can be used in automations" }, { status: 422 });
  }

  const [automation] = await db
    .insert(automations)
    .values({
      teamId: session.teamId,
      wabaAccountId,
      templateId,
      name,
      trigger,
      triggerConfig: trigger === "keyword_reply" ? { keyword } : {},
      variableMapping,
      isActive: true,
    })
    .returning();

  return NextResponse.json({ automation });
}
