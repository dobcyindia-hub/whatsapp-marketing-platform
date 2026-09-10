import { headers } from "next/headers";
import { PageHeader } from "@/components/dashboard/page-header";
import { WhatsAppManager } from "@/components/dashboard/whatsapp-manager";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { eq } from "drizzle-orm";

export default async function WhatsAppPage() {
  const session = await getSession();
  const accounts = session
    ? await db.query.wabaAccounts.findMany({
        where: eq(wabaAccounts.teamId, session.teamId),
        columns: {
          id: true,
          wabaId: true,
          phoneNumberId: true,
          displayPhoneNumber: true,
          displayName: true,
          status: true,
          messagingTier: true,
          webhookVerifyToken: true,
          lastSyncedAt: true,
        },
      })
    : [];

  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const webhookOrigin = host ? `${proto}://${host}` : "";

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Connect and manage your Meta WhatsApp Cloud API numbers."
      />
      <WhatsAppManager
        accounts={accounts.map((a) => ({ ...a, lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null }))}
        webhookOrigin={webhookOrigin}
      />
    </div>
  );
}
