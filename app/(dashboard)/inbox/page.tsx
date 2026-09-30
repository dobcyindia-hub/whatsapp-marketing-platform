import { PageHeader } from "@/components/dashboard/page-header";
import { InboxDashboard } from "@/components/dashboard/inbox-dashboard";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { contacts, templates, messageEvents } from "@/database/schema";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";

export default async function InboxPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div>
        <PageHeader title="Inbox" description="Messages people have sent to your connected WhatsApp number." />
      </div>
    );
  }

  const threadContacts = await db.query.contacts.findMany({
    where: and(eq(contacts.teamId, session.teamId), or(isNotNull(contacts.lastInboundAt), isNotNull(contacts.lastMessagedAt))),
  });

  const previews = await Promise.all(
    threadContacts.map(async (c) => {
      const last = await db.query.messageEvents.findFirst({
        where: and(eq(messageEvents.teamId, session.teamId), eq(messageEvents.contactId, c.id)),
        orderBy: desc(messageEvents.createdAt),
      });
      const raw = last?.rawPayload as { type?: string; text?: { body?: string }; templateName?: string } | undefined;
      const preview =
        raw?.type === "text" && raw.text?.body
          ? raw.text.body
          : raw?.templateName
            ? `Template: ${raw.templateName}`
            : last?.eventType
              ? last.eventType.replace(/_/g, " ")
              : "";
      const lastActivityAt = last?.createdAt ?? c.lastInboundAt ?? c.lastMessagedAt ?? c.createdAt;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        lastActivityAt: lastActivityAt.toISOString(),
        lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
        preview,
      };
    })
  );

  previews.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  const templateRows = await db.query.templates.findMany({
    where: and(eq(templates.teamId, session.teamId), eq(templates.status, "approved")),
    columns: { id: true, name: true, language: true, variableCount: true },
  });

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Conversations with people who've messaged your WhatsApp number."
      />
      <InboxDashboard threads={previews} templates={templateRows} />
    </div>
  );
}
