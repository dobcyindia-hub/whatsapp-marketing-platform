import { PageHeader, EmptyState } from "@/components/dashboard/page-header";

export default function WhatsAppPage() {
  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Connect and manage your Meta WhatsApp Cloud API numbers."
      />
      <EmptyState
        title="No number connected"
        description="Connect a WhatsApp Business Account and phone number via the Meta Cloud API to start sending messages."
      />
    </div>
  );
}
