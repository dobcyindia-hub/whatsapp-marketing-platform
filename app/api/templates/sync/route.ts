import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { templates, wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import { fetchTemplates, GraphApiError } from "@/lib/whatsapp/graph-client";
import { parseMetaTemplate } from "@/lib/whatsapp/template-utils";
import { and, eq } from "drizzle-orm";

const syncSchema = z.object({ wabaAccountId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const account = await db.query.wabaAccounts.findFirst({
    where: and(eq(wabaAccounts.id, parsed.data.wabaAccountId), eq(wabaAccounts.teamId, session.teamId)),
  });
  if (!account) return NextResponse.json({ error: "WhatsApp number not found" }, { status: 404 });

  const accessToken = decryptSecret(account.accessTokenEncrypted);

  let metaTemplates;
  try {
    metaTemplates = await fetchTemplates(account.wabaId, accessToken);
  } catch (err) {
    if (err instanceof GraphApiError) {
      return NextResponse.json({ error: `Meta rejected this request: ${err.message}` }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach the Meta Graph API" }, { status: 502 });
  }

  let synced = 0;
  for (const mt of metaTemplates) {
    const parsedTemplate = parseMetaTemplate(mt);
    const status = mt.status.toLowerCase() as typeof templates.$inferInsert.status;
    const category = mt.category.toLowerCase() as typeof templates.$inferInsert.category;

    await db
      .insert(templates)
      .values({
        teamId: session.teamId,
        wabaAccountId: account.id,
        metaTemplateId: mt.id,
        name: mt.name,
        language: mt.language,
        category,
        status,
        bodyText: parsedTemplate.bodyText,
        headerType: parsedTemplate.headerType,
        headerText: parsedTemplate.headerText,
        footerText: parsedTemplate.footerText,
        buttons: parsedTemplate.buttons,
        variableCount: parsedTemplate.variableCount,
        rejectionReason: mt.rejected_reason ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [templates.wabaAccountId, templates.name, templates.language],
        set: {
          metaTemplateId: mt.id,
          status,
          category,
          bodyText: parsedTemplate.bodyText,
          headerType: parsedTemplate.headerType,
          headerText: parsedTemplate.headerText,
          footerText: parsedTemplate.footerText,
          buttons: parsedTemplate.buttons,
          variableCount: parsedTemplate.variableCount,
          rejectionReason: mt.rejected_reason ?? null,
          updatedAt: new Date(),
        },
      });
    synced++;
  }

  await db
    .update(wabaAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(wabaAccounts.id, account.id));

  return NextResponse.json({ synced });
}
