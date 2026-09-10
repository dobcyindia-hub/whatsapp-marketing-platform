import { PageHeader } from "@/components/dashboard/page-header";
import { TemplatesManager } from "@/components/dashboard/templates-manager";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { templates, wabaAccounts } from "@/database/schema";
import { desc, eq } from "drizzle-orm";

export default async function TemplatesPage() {
  const session = await getSession();

  const [templateRows, accountRows] = session
    ? await Promise.all([
        db.query.templates.findMany({
          where: eq(templates.teamId, session.teamId),
          orderBy: desc(templates.createdAt),
        }),
        db.query.wabaAccounts.findMany({
          where: eq(wabaAccounts.teamId, session.teamId),
          columns: { id: true, displayName: true, displayPhoneNumber: true },
        }),
      ])
    : [[], []];

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Meta-approved WhatsApp message templates."
      />
      <TemplatesManager initialTemplates={templateRows} accounts={accountRows} />
    </div>
  );
}
