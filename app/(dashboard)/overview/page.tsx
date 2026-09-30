import { PageHeader } from "@/components/dashboard/page-header";
import { QueueHealthWidget } from "@/components/dashboard/queue-health-widget";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { campaigns, contacts, wabaAccounts } from "@/database/schema";
import { eq } from "drizzle-orm";

async function getStats(teamId: string) {
  const [contactRows, campaignRows, wabaRows] = await Promise.all([
    db.query.contacts.findMany({ where: eq(contacts.teamId, teamId) }),
    db.query.campaigns.findMany({ where: eq(campaigns.teamId, teamId) }),
    db.query.wabaAccounts.findMany({ where: eq(wabaAccounts.teamId, teamId) }),
  ]);
  return {
    totalContacts: contactRows.length,
    optedOut: contactRows.filter((c) => c.optedOut).length,
    totalCampaigns: campaignRows.length,
    connectedNumbers: wabaRows.filter((w) => w.status === "connected").length,
  };
}

export default async function OverviewPage() {
  const session = await getSession();
  const stats = session ? await getStats(session.teamId) : null;

  const cards = [
    { label: "Contacts", value: stats?.totalContacts ?? 0 },
    { label: "Opted out", value: stats?.optedOut ?? 0 },
    { label: "Campaigns", value: stats?.totalCampaigns ?? 0 },
    { label: "Connected numbers", value: stats?.connectedNumbers ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Your WhatsApp marketing at a glance."
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{c.label}</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {stats?.connectedNumbers === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          No WhatsApp number connected yet. Head to the{" "}
          <a href="/whatsapp" className="font-medium underline">
            WhatsApp
          </a>{" "}
          tab to connect your Meta Cloud API number before sending campaigns.
        </div>
      )}

      <QueueHealthWidget />
    </div>
  );
}
