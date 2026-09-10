import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { eq } from "drizzle-orm";
import { verifyMetaSignature } from "@/lib/webhooks/verify-signature";
import { processWebhookPayload } from "@/lib/webhooks/process-event";
import type { MetaWebhookPayload } from "@/lib/webhooks/types";

// Meta calls this once, at the time the webhook URL is configured in the
// App Dashboard, to confirm this endpoint controls the verify token.
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const account = await db.query.wabaAccounts.findFirst({
    where: eq(wabaAccounts.webhookVerifyToken, token),
  });

  if (!account) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge ?? "", { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  // Always ack 200 once the payload is at least parseable — Meta disables
  // the subscription after repeated non-200s, and a processing error here
  // shouldn't be retried indefinitely by Meta's own retry logic.
  try {
    await processWebhookPayload(payload);
  } catch (err) {
    console.error("[webhook] failed to process payload", err);
  }

  return NextResponse.json({ received: true });
}
