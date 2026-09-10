import { PageHeader, EmptyState } from "@/components/dashboard/page-header";

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        title="Templates"
        description="Meta-approved WhatsApp message templates."
      />
      <EmptyState
        title="No templates synced"
        description="Connect a WhatsApp number, then sync your Meta-approved templates to use them in campaigns."
      />
    </div>
  );
}
