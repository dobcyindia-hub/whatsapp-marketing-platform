"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this campaign? Recipients not yet sent will be skipped.")) return;
    setLoading(true);
    await fetch(`/api/campaigns/${campaignId}/cancel`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-500/10"
    >
      {loading ? "Cancelling…" : "Cancel campaign"}
    </button>
  );
}
