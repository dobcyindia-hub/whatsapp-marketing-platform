import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { templates, wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import { createTemplate, GraphApiError } from "@/lib/whatsapp/graph-client";
import { buildTemplateComponents, countVariables } from "@/lib/whatsapp/template-utils";
import { and, desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.templates.findMany({
    where: eq(templates.teamId, session.teamId),
    orderBy: desc(templates.createdAt),
  });

  return NextResponse.json({ templates: rows });
}

const createSchema = z.object({
  wabaAccountId: z.string().uuid(),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only"),
  language: z.string().min(2).max(16),
  category: z.enum(["marketing", "utility", "authentication"]),
  headerText: z.string().max(60).optional(),
  bodyText: z.string().min(1).max(1024),
  footerText: z.string().max(60).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { wabaAccountId, name, language, category, headerText, bodyText, footerText } = parsed.data;

  const account = await db.query.wabaAccounts.findFirst({
    where: and(eq(wabaAccounts.id, wabaAccountId), eq(wabaAccounts.teamId, session.teamId)),
  });
  if (!account) return NextResponse.json({ error: "WhatsApp number not found" }, { status: 404 });

  const accessToken = decryptSecret(account.accessTokenEncrypted);
  const components = buildTemplateComponents({ headerText, bodyText, footerText });

  let metaResult;
  try {
    metaResult = await createTemplate({
      wabaId: account.wabaId,
      accessToken,
      name,
      language,
      category: category.toUpperCase() as "MARKETING" | "UTILITY" | "AUTHENTICATION",
      components,
    });
  } catch (err) {
    if (err instanceof GraphApiError) {
      return NextResponse.json({ error: `Meta rejected this template: ${err.message}` }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach the Meta Graph API" }, { status: 502 });
  }

  const [template] = await db
    .insert(templates)
    .values({
      teamId: session.teamId,
      wabaAccountId: account.id,
      metaTemplateId: metaResult.id,
      name,
      language,
      category,
      status: (metaResult.status?.toLowerCase() as typeof templates.$inferInsert.status) ?? "pending",
      bodyText,
      headerType: headerText ? "TEXT" : null,
      headerText: headerText ?? null,
      footerText: footerText ?? null,
      variableCount: countVariables(bodyText),
    })
    .returning();

  return NextResponse.json({ template });
}
