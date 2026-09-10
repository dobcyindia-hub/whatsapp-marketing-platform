import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { teams } from "@/database/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const team = await db.query.teams.findFirst({ where: eq(teams.id, session.teamId) });

  return (
    <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-zinc-900">
      <Sidebar email={session.email} teamName={team?.name ?? "Workspace"} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
