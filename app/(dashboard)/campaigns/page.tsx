import { PageHeader } from "@/components/dashboard/page-header";
import { CampaignsManager } from "@/components/dashboard/campaigns-manager";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { campaigns, templates, contactLists, contactListMembers } from "@/database/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export default async function CampaignsPage() {
  const session = await getSession();

  const [campaignRows, templateRows, listRows] = session
    ? await Promise.all([
        db.query.campaigns.findMany({
          where: eq(campaigns.teamId, session.teamId),
          orderBy: desc(campaigns.createdAt),
          with: { template: { columns: { name: true } }, list: { columns: { name: true } } },
        }),
        db.query.templates.findMany({
          where: and(eq(templates.teamId, session.teamId), eq(templates.status, "approved")),
          columns: { id: true, name: true, language: true, variableCount: true, wabaAccountId: true },
        }),
        db
          .select({
            id: contactLists.id,
            name: contactLists.name,
            memberCount: sql<number>`count(${contactListMembers.id})::int`,
          })
          .from(contactLists)
          .leftJoin(contactListMembers, eq(contactListMembers.listId, contactLists.id))
          .where(eq(contactLists.teamId, session.teamId))
          .groupBy(contactLists.id)
          .orderBy(contactLists.createdAt),
      ])
    : [[], [], []];

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Send bulk WhatsApp campaigns and track delivery."
      />
      <CampaignsManager
        initialCampaigns={campaignRows.map((c) => ({
          ...c,
          scheduledAt: c.scheduledAt?.toISOString() ?? null,
        }))}
        templates={templateRows}
        lists={listRows}
      />
    </div>
  );
}
