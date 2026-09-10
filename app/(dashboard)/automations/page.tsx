import { PageHeader } from "@/components/dashboard/page-header";
import { AutomationsManager } from "@/components/dashboard/automations-manager";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { automations, templates, wabaAccounts } from "@/database/schema";
import { and, desc, eq } from "drizzle-orm";

export default async function AutomationsPage() {
  const session = await getSession();

  const [automationRows, templateRows, accountRows] = session
    ? await Promise.all([
        db.query.automations.findMany({
          where: eq(automations.teamId, session.teamId),
          orderBy: desc(automations.createdAt),
          with: {
            template: { columns: { name: true } },
            wabaAccount: { columns: { displayName: true, displayPhoneNumber: true } },
          },
        }),
        db.query.templates.findMany({
          where: and(eq(templates.teamId, session.teamId), eq(templates.status, "approved")),
          columns: { id: true, name: true, language: true, variableCount: true, wabaAccountId: true },
        }),
        db.query.wabaAccounts.findMany({
          where: eq(wabaAccounts.teamId, session.teamId),
          columns: { id: true, displayName: true, displayPhoneNumber: true },
        }),
      ])
    : [[], [], []];

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Trigger messages automatically on events like new contacts or keyword replies."
      />
      <AutomationsManager initialAutomations={automationRows} templates={templateRows} accounts={accountRows} />
    </div>
  );
}
