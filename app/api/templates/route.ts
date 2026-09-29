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

const buttonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
  text: z.string().min(1).max(25),
  value: z.string().max(2000).optional(),
});

const createSchema = z.object({
  wabaAccountId: z.string().uuid(),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only"),
  language: z.string().min(2).max(16),
  category: z.enum(["marketing", "utility", "authentication"]),
  headerType: z.enum(["none", "text", "image", "video", "document"]).default("none"),
  headerText: z.string().max(60).optional(),
  headerMediaHandle: z.string().optional(),
  bodyText: z.string().min(1).max(1024),
  footerText: z.string().max(60).optional(),
  buttons: z.array(buttonSchema).max(3).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { wabaAccountId, name, language, category, headerType, headerText, headerMediaHandle, bodyText, footerText, buttons } =
    parsed.data;

  if ((headerType === "image" || headerType === "video" || headerType === "document") && !headerMediaHandle) {
    return NextResponse.json({ error: "Upload a media file for this header type first" }, { status: 400 });
  }

  const account = await db.query.wabaAccounts.findFirst({
    where: and(eq(wabaAccounts.id, wabaAccountId), eq(wabaAccounts.teamId, session.teamId)),
  });
  if (!account) return NextResponse.json({ error: "WhatsApp number not found" }, { status: 404 });

  const accessToken = decryptSecret(account.accessTokenEncrypted);
  const metaHeaderType = headerType === "none" ? undefined : (headerType.toUpperCase() as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT");
  const components = buildTemplateComponents({
    headerType: metaHeaderType,
    headerText,
    headerMediaHandle,
    bodyText,
    footerText,
    buttons,
  });

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
      headerType: metaHeaderType ?? null,
      headerText: headerType === "text" ? headerText ?? null : null,
      footerText: footerText ?? null,
      buttons: buttons ?? [],
      variableCount: countVariables(bodyText),
    })
    .returning();

  return NextResponse.json({ template });
}
