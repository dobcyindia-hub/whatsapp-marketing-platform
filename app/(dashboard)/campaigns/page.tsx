import { PageHeader, EmptyState } from "@/components/dashboard/page-header";

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Send bulk WhatsApp campaigns and track delivery."
      />
      <EmptyState
        title="No campaigns yet"
        description="Pick a template and a contact list to launch your first campaign."
      />
    </div>
  );
}
