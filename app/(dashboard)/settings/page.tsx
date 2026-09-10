import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsManager } from "@/components/dashboard/settings-manager";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { teams } from "@/database/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const session = await getSession();
  const team = session ? await db.query.teams.findFirst({ where: eq(teams.id, session.teamId) }) : null;

  return (
    <div>
      <PageHeader title="Settings" description="Account, team, and workspace settings." />
      {session && <SettingsManager email={session.email} teamName={team?.name ?? ""} />}
    </div>
  );
}
