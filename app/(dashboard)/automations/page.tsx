import { PageHeader, EmptyState } from "@/components/dashboard/page-header";

export default function AutomationsPage() {
  return (
    <div>
      <PageHeader
        title="Automations"
        description="Trigger messages automatically on events like new contacts or keyword replies."
      />
      <EmptyState
        title="No automations yet"
        description="Create a rule to send a template automatically when a contact is added or replies with a keyword."
      />
    </div>
  );
}
