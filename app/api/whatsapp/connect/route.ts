import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto";
import { fetchPhoneNumberInfo, GraphApiError } from "@/lib/whatsapp/graph-client";

const connectSchema = z.object({
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
  appId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { wabaId, phoneNumberId, accessToken, appId } = parsed.data;

  let phoneInfo;
  try {
    phoneInfo = await fetchPhoneNumberInfo(phoneNumberId, accessToken);
  } catch (err) {
    if (err instanceof GraphApiError) {
      return NextResponse.json(
        { error: `Meta rejected these credentials: ${err.message}` },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: "Could not reach the Meta Graph API" }, { status: 502 });
  }

  const [account] = await db
    .insert(wabaAccounts)
    .values({
      teamId: session.teamId,
      wabaId,
      phoneNumberId,
      displayPhoneNumber: phoneInfo.display_phone_number,
      displayName: phoneInfo.verified_name,
      accessTokenEncrypted: encryptSecret(accessToken),
      appId,
      webhookVerifyToken: randomBytes(24).toString("hex"),
      status: "connected",
      lastSyncedAt: new Date(),
    })
    .returning();

  return NextResponse.json({
    id: account.id,
    displayPhoneNumber: account.displayPhoneNumber,
    displayName: account.displayName,
    status: account.status,
    webhookVerifyToken: account.webhookVerifyToken,
  });
}
