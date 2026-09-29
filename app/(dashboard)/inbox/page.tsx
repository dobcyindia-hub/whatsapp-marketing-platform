import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { messageEvents } from "@/database/schema";
import { and, desc, eq } from "drizzle-orm";

function extractPreview(rawPayload: unknown): string {
  const msg = rawPayload as { type?: string; text?: { body?: string } };
  if (msg?.type === "text" && msg.text?.body) return msg.text.body;
  if (msg?.type) return `[${msg.type} message]`;
  return "(no content)";
}

export default async function InboxPage() {
  const session = await getSession();

  const events = session
    ? await db.query.messageEvents.findMany({
        where: and(eq(messageEvents.teamId, session.teamId), eq(messageEvents.eventType, "inbound")),
        orderBy: desc(messageEvents.createdAt),
        limit: 100,
        with: { contact: { columns: { name: true, phone: true } } },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Messages people have sent to your connected WhatsApp number."
      />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">From</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  No messages yet. Once someone messages your connected number, it&apos;ll show up here.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {e.contact?.name || e.contact?.phone || "Unknown"}
                  </div>
                  {e.contact?.name && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{e.contact.phone}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{extractPreview(e.rawPayload)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {e.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
