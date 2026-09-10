import { PageHeader } from "@/components/dashboard/page-header";
import { SentVolumeChart } from "@/components/dashboard/sent-volume-chart";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { campaigns, campaignRecipients, templates } from "@/database/schema";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="Analytics" description="Delivery, read, and reply performance across campaigns and templates." />
      </div>
    );
  }

  const teamCampaigns = await db.query.campaigns.findMany({ where: eq(campaigns.teamId, session.teamId) });

  const totals = teamCampaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + c.sentCount,
      delivered: acc.delivered + c.deliveredCount,
      read: acc.read + c.readCount,
      failed: acc.failed + c.failedCount,
      replied: acc.replied + c.repliedCount,
    }),
    { sent: 0, delivered: 0, read: 0, failed: 0, replied: 0 }
  );

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const dailyRows = await db
    .select({
      day: sql<string>`date_trunc('day', ${campaignRecipients.sentAt})`,
      count: sql<number>`count(*)::int`,
    })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(
      and(
        eq(campaigns.teamId, session.teamId),
        isNotNull(campaignRecipients.sentAt),
        gte(campaignRecipients.sentAt, fourteenDaysAgo)
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const dayMap = new Map(dailyRows.map((r) => [new Date(r.day).toDateString(), r.count]));
  const dailySeries = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    return { day: d.toISOString(), count: dayMap.get(d.toDateString()) ?? 0 };
  });

  const templateRows = await db
    .select({
      templateId: campaigns.templateId,
      name: templates.name,
      category: templates.category,
      sent: sql<number>`sum(${campaigns.sentCount})::int`,
      delivered: sql<number>`sum(${campaigns.deliveredCount})::int`,
      read: sql<number>`sum(${campaigns.readCount})::int`,
      failed: sql<number>`sum(${campaigns.failedCount})::int`,
      replied: sql<number>`sum(${campaigns.repliedCount})::int`,
    })
    .from(campaigns)
    .innerJoin(templates, eq(templates.id, campaigns.templateId))
    .where(eq(campaigns.teamId, session.teamId))
    .groupBy(campaigns.templateId, templates.name, templates.category)
    .orderBy(sql`sum(${campaigns.sentCount}) desc`);

  const statTiles = [
    { label: "Messages sent", value: totals.sent.toLocaleString() },
    { label: "Delivery rate", value: pct(totals.delivered, totals.sent) },
    { label: "Read rate", value: pct(totals.read, totals.sent) },
    { label: "Reply rate", value: pct(totals.replied, totals.sent) },
    { label: "Failed", value: totals.failed.toLocaleString() },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Delivery, read, and reply performance across campaigns and templates."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {statTiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.label}</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">Messages sent per day (last 14 days)</h3>
        {totals.sent === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No campaigns sent yet — this chart fills in once you launch one.
          </p>
        ) : (
          <SentVolumeChart data={dailySeries} />
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Performance by template</h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">Delivered</th>
                <th className="px-4 py-3 font-medium">Read</th>
                <th className="px-4 py-3 font-medium">Replied</th>
                <th className="px-4 py-3 font-medium">Failed</th>
              </tr>
            </thead>
            <tbody>
              {templateRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    No campaign data yet.
                  </td>
                </tr>
              )}
              {templateRows.map((t) => (
                <tr key={t.templateId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">{t.name}</div>
                    <div className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{t.category}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{t.sent}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {t.delivered} <span className="text-xs text-zinc-400">({pct(t.delivered, t.sent)})</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {t.read} <span className="text-xs text-zinc-400">({pct(t.read, t.sent)})</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {t.replied} <span className="text-xs text-zinc-400">({pct(t.replied, t.sent)})</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{t.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
