import { PageHeader, EmptyState } from "@/components/dashboard/page-header";

export default function ContactsPage() {
  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Manage your contact lists, tags, and opt-out status."
      />
      <EmptyState
        title="No contacts yet"
        description="Import a CSV or add contacts manually to start building your audience."
      />
    </div>
  );
}
