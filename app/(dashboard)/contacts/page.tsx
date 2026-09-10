import { PageHeader } from "@/components/dashboard/page-header";
import { ContactsManager } from "@/components/dashboard/contacts-manager";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { contacts, contactLists, contactListMembers } from "@/database/schema";
import { desc, eq, sql } from "drizzle-orm";

export default async function ContactsPage() {
  const session = await getSession();

  const [contactRows, listRows] = session
    ? await Promise.all([
        db.query.contacts.findMany({
          where: eq(contacts.teamId, session.teamId),
          orderBy: desc(contacts.createdAt),
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
    : [[], []];

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage your contact lists, tags, and opt-out status."
      />
      <ContactsManager
        initialContacts={contactRows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        initialLists={listRows}
      />
    </div>
  );
}
