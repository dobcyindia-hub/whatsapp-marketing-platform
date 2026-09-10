import { PageHeader, EmptyState } from "@/components/dashboard/page-header";

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Delivery, read, and reply performance across campaigns and templates."
      />
      <EmptyState
        title="No data yet"
        description="Analytics will appear here once you start sending campaigns."
      />
    </div>
  );
}
