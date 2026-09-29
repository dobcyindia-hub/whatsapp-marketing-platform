import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import { uploadTemplateMedia, GraphApiError } from "@/lib/whatsapp/graph-client";
import { and, eq } from "drizzle-orm";

const MAX_SIZE_BYTES = 16 * 1024 * 1024; // 16MB, comfortably under Meta's per-type caps

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const wabaAccountId = formData.get("wabaAccountId");
  const file = formData.get("file");

  if (typeof wabaAccountId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing wabaAccountId or file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 16MB)" }, { status: 400 });
  }

  const account = await db.query.wabaAccounts.findFirst({
    where: and(eq(wabaAccounts.id, wabaAccountId), eq(wabaAccounts.teamId, session.teamId)),
  });
  if (!account) return NextResponse.json({ error: "WhatsApp number not found" }, { status: 404 });
  if (!account.appId) {
    return NextResponse.json(
      { error: "This WhatsApp number was connected without a Meta App ID — reconnect it with the App ID filled in to upload media." },
      { status: 422 }
    );
  }

  try {
    const accessToken = decryptSecret(account.accessTokenEncrypted);
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const handle = await uploadTemplateMedia({
      appId: account.appId,
      accessToken,
      fileBytes,
      fileType: file.type || "application/octet-stream",
      fileName: file.name || "upload",
    });
    return NextResponse.json({ handle });
  } catch (err) {
    if (err instanceof GraphApiError) {
      return NextResponse.json({ error: `Meta rejected this upload: ${err.message}` }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach the Meta Graph API" }, { status: 502 });
  }
}
