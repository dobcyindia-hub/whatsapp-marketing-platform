import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { contacts, messageEvents, wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import {
  sendSessionMessage,
  uploadMessageMedia,
  GraphApiError,
  type MessageMediaType,
} from "@/lib/whatsapp/graph-client";
import { and, desc, eq } from "drizzle-orm";

const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SIZE_BYTES = 16 * 1024 * 1024;

function mediaTypeFor(mimeType: string): MessageMediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const contactId = formData.get("contactId");
  const text = formData.get("text");
  const file = formData.get("file");

  if (typeof contactId !== "string") {
    return NextResponse.json({ error: "Missing contactId" }, { status: 400 });
  }
  if (!text && !(file instanceof File)) {
    return NextResponse.json({ error: "Provide a message or a file" }, { status: 400 });
  }
  if (file instanceof File && file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 16MB)" }, { status: 400 });
  }

  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.teamId, session.teamId)),
  });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (contact.optedOut) {
    return NextResponse.json({ error: "This contact has opted out — cannot message them" }, { status: 422 });
  }

  if (!contact.lastInboundAt || Date.now() - contact.lastInboundAt.getTime() > SESSION_WINDOW_MS) {
    return NextResponse.json(
      {
        error:
          "Outside the 24-hour customer service window — Meta only allows an approved template here, not a free-form message.",
      },
      { status: 422 }
    );
  }

  // Send from whichever connected number this contact actually messaged in.
  const lastInbound = await db.query.messageEvents.findFirst({
    where: and(eq(messageEvents.teamId, session.teamId), eq(messageEvents.contactId, contactId), eq(messageEvents.eventType, "inbound")),
    orderBy: desc(messageEvents.createdAt),
  });
  const account = lastInbound
    ? await db.query.wabaAccounts.findFirst({ where: and(eq(wabaAccounts.id, lastInbound.wabaAccountId), eq(wabaAccounts.teamId, session.teamId)) })
    : await db.query.wabaAccounts.findFirst({ where: eq(wabaAccounts.teamId, session.teamId) });
  if (!account) return NextResponse.json({ error: "No connected WhatsApp number found" }, { status: 404 });

  try {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    let result;
    let rawPayload: Record<string, unknown>;

    if (file instanceof File) {
      const fileBytes = Buffer.from(await file.arrayBuffer());
      const mediaId = await uploadMessageMedia({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        fileBytes,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name || "upload",
      });
      const type = mediaTypeFor(file.type || "");
      result = await sendSessionMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: contact.phone,
        media: {
          type,
          id: mediaId,
          caption: typeof text === "string" && text ? text : undefined,
          filename: file.name,
        },
      });
      rawPayload = { type, fileName: file.name, caption: text, metaResponse: result };
    } else {
      result = await sendSessionMessage({
        phoneNumberId: account.phoneNumberId,
        accessToken,
        to: contact.phone,
        text: String(text),
      });
      rawPayload = { type: "text", text: { body: String(text) }, metaResponse: result };
    }

    await db.insert(messageEvents).values({
      teamId: session.teamId,
      wabaAccountId: account.id,
      contactId: contact.id,
      eventType: "outbound_message",
      metaMessageId: result.messages?.[0]?.id ?? null,
      rawPayload,
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
        rawPayload: { error: err.message, code: err.code },
      });
      return NextResponse.json({ error: `Meta rejected this send: ${err.message}` }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach the Meta Graph API" }, { status: 502 });
  }
}
