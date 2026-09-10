import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { eq } from "drizzle-orm";

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

// Full delivery/read/reply event processing lands in a later phase — for
// now this just acknowledges so Meta doesn't disable the subscription for
// timing out or erroring.
export async function POST(request: NextRequest) {
  await request.text().catch(() => null);
  return NextResponse.json({ received: true });
}
