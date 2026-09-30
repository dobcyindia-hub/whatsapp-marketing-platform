"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type UndeliveredRecipient = {
  contactId: string;
  phone: string;
  name: string | null;
  status: string;
  errorMessage: string | null;
};

function downloadCsv(rows: UndeliveredRecipient[], campaignName: string) {
  const header = "name,phone,status,error";
  const lines = rows.map((r) =>
    [r.name ?? "", r.phone, r.status, (r.errorMessage ?? "").replace(/,/g, ";")]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${campaignName.replace(/[^a-z0-9]/gi, "_")}_undelivered.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function RetargetPanel({
  recipients,
  campaignName,
}: {
  recipients: UndeliveredRecipient[];
  campaignName: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (recipients.length === 0) return null;

  async function handleCreateList() {
    setCreating(true);
    setError(null);
    setResult(null);

    const createRes = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${campaignName} — retarget (${recipients.length})` }),
    });
    if (!createRes.ok) {
      setCreating(false);
      const data = await createRes.json().catch(() => ({}));
      setError(data.error ?? "Could not create list");
      return;
    }
    const { list } = await createRes.json();

    const addRes = await fetch(`/api/lists/${list.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: recipients.map((r) => r.contactId) }),
    });
    setCreating(false);
    if (!addRes.ok) {
      const data = await addRes.json().catch(() => ({}));
      setError(data.error ?? "List created, but could not add contacts");
      return;
    }
    setResult(`Created "${list.name}" — go to Campaigns to send to it.`);
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-500/10">
      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
        {recipients.length} didn&apos;t get delivered
      </span>
      <button
        onClick={() => downloadCsv(recipients, campaignName)}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-500/10"
      >
        Download CSV
      </button>
      <button
        onClick={handleCreateList}
        disabled={creating}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create retargeting list"}
      </button>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      {result && <span className="text-sm text-emerald-700 dark:text-emerald-400">{result}</span>}
    </div>
  );
}
