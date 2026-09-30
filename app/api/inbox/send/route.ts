import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contacts, templates, wabaAccounts, messageEvents } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import { sendTemplateMessage, GraphApiError } from "@/lib/whatsapp/graph-client";
import { resolveVariablesForContact } from "@/lib/whatsapp/template-utils";
import { and, eq } from "drizzle-orm";

const sendSchema = z.object({
  contactId: z.string().uuid(),
  templateId: z.string().uuid(),
  variableValues: z.record(z.string(), z.string()).default({}),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { contactId, templateId, variableValues } = parsed.data;

  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.teamId, session.teamId)),
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (contact.optedOut) {
    return NextResponse.json({ error: "This contact has opted out — cannot message them" }, { status: 422 });
  }

  const template = await db.query.templates.findFirst({
    where: and(eq(templates.id, templateId), eq(templates.teamId, session.teamId)),
    with: { wabaAccount: true },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (template.status !== "approved") {
    return NextResponse.json({ error: "Only approved templates can be sent" }, { status: 422 });
  }

  const account = await db.query.wabaAccounts.findFirst({
    where: and(eq(wabaAccounts.id, template.wabaAccountId), eq(wabaAccounts.teamId, session.teamId)),
  });
  if (!account) return NextResponse.json({ error: "WhatsApp number not found" }, { status: 404 });

  // Per-variable direct values (index -> text) take priority; anything left
  // blank falls back to the contact's own name/phone/email.
  const mapping: Record<string, string> = {};
  for (let i = 1; i <= template.variableCount; i++) {
    mapping[String(i)] = variableValues[String(i)] ? `static:${variableValues[String(i)]}` : "field:name";
  }
  const bodyParams = resolveVariablesForContact(template.variableCount, mapping, {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
  });

  try {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    const result = await sendTemplateMessage({
      phoneNumberId: account.phoneNumberId,
      accessToken,
      to: contact.phone,
      templateName: template.name,
      languageCode: template.language,
      bodyParams,
    });

    await db.insert(messageEvents).values({
      teamId: session.teamId,
      wabaAccountId: account.id,
      contactId: contact.id,
      eventType: "outbound_template",
      metaMessageId: result.messages?.[0]?.id ?? null,
      rawPayload: { templateName: template.name, bodyParams, metaResponse: result },
    });
    await db.update(contacts).set({ lastMessagedAt: new Date() }).where(eq(contacts.id, contact.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GraphApiError) {
      await db.insert(messageEvents).values({
        teamId: session.teamId,
        wabaAccountId: account.id,
        contactId: contact.id,
        eventType: "outbound_failed",
        rawPayload: { templateName: template.name, error: err.message, code: err.code },
      });
      return NextResponse.json({ error: `Meta rejected this send: ${err.message}` }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach the Meta Graph API" }, { status: 502 });
  }
}
