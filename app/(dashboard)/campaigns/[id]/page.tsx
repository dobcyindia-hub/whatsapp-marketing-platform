import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { campaigns } from "@/database/schema";
import { and, eq } from "drizzle-orm";

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function statusColor(status: string) {
  switch (status) {
    case "delivered":
    case "read":
    case "replied":
    case "sent":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "failed":
      return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    case "skipped_opted_out":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
    default:
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  }
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();

  const campaign = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.id, id), eq(campaigns.teamId, session.teamId)),
    with: {
      template: { columns: { name: true, bodyText: true } },
      list: { columns: { name: true } },
      recipients: {
        with: { contact: { columns: { name: true, phone: true } } },
      },
    },
  });
  if (!campaign) notFound();

  const stats = [
    { label: "Total", value: campaign.totalRecipients },
    { label: "Sent", value: campaign.sentCount, rate: pct(campaign.sentCount, campaign.totalRecipients) },
    { label: "Delivered", value: campaign.deliveredCount, rate: pct(campaign.deliveredCount, campaign.sentCount) },
    { label: "Read", value: campaign.readCount, rate: pct(campaign.readCount, campaign.sentCount) },
    { label: "Replied", value: campaign.repliedCount, rate: pct(campaign.repliedCount, campaign.sentCount) },
    { label: "Failed", value: campaign.failedCount, rate: pct(campaign.failedCount, campaign.totalRecipients) },
  ];

  return (
    <div>
      <Link href="/campaigns" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
        ← Back to campaigns
      </Link>
      <PageHeader
        title={campaign.name}
        description={`${campaign.template?.name ?? "—"} · ${campaign.list?.name ?? "—"}`}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{s.value}</div>
            {"rate" in s && <div className="text-xs text-zinc-400">{s.rate}</div>}
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Recipients</h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                    No recipients.
                  </td>
                </tr>
              )}
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {r.contact.name || r.contact.phone}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{r.contact.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(r.status)}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{r.errorMessage ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
