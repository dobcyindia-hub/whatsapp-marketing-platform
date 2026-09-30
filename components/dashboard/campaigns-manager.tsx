"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type TemplateOption = {
  id: string;
  name: string;
  language: string;
  variableCount: number;
  wabaAccountId: string;
};

export type ListOption = {
  id: string;
  name: string;
  memberCount: number;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  repliedCount: number;
  scheduledAt: string | null;
  template: { name: string } | null;
  list: { name: string } | null;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "sending":
      return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
    case "scheduled":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "failed":
      return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function CampaignsManager({
  initialCampaigns,
  templates,
  lists,
}: {
  initialCampaigns: CampaignRow[];
  templates: TemplateOption[];
  lists: ListOption[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [listId, setListId] = useState(lists[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipRecentDays, setSkipRecentDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
  const variableIndexes = useMemo(
    () => Array.from({ length: selectedTemplate?.variableCount ?? 0 }, (_, i) => i + 1),
    [selectedTemplate]
  );

  function updateMapping(index: number, value: string) {
    setMapping((prev) => ({ ...prev, [String(index)]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!templateId || !listId) {
      setError("Choose a template and a contact list");
      return;
    }
    if (!selectedTemplate) return;

    setLoading(true);
    const createRes = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        wabaAccountId: selectedTemplate.wabaAccountId,
        templateId,
        listId,
        variableMapping: mapping,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      }),
    });

    if (!createRes.ok) {
      const data = await createRes.json().catch(() => ({}));
      setLoading(false);
      setError(data.error ?? "Could not create campaign");
      return;
    }

    const { campaign } = await createRes.json();
    const sendRes = await fetch(`/api/campaigns/${campaign.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skipRecentlyMessagedDays: skipRecentDays ? Number(skipRecentDays) : undefined,
      }),
    });
    setLoading(false);

    if (!sendRes.ok) {
      const data = await sendRes.json().catch(() => ({}));
      setError(data.error ?? "Campaign created but could not be launched");
      router.refresh();
      return;
    }

    setName("");
    setMapping({});
    setScheduledAt("");
    setSkipRecentDays("");
    setShowForm(false);
    router.refresh();
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id);
    await fetch(`/api/campaigns/${id}/duplicate`, { method: "POST" });
    setDuplicatingId(null);
    router.refresh();
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">No approved templates yet</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Campaigns can only use Meta-approved templates. Sync or create one first.
        </p>
        <a
          href="/templates"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Go to Templates
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New campaign
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Campaign name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Contact list</label>
              <select value={listId} onChange={(e) => setListId(e.target.value)} className={inputClass}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.memberCount})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {variableIndexes.length > 0 && (
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Personalization variables</label>
              <div className="mt-2 space-y-2">
                {variableIndexes.map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{`{{${i}}}`}</span>
                    <select
                      value={mapping[String(i)]?.split(":")[0] ?? "field"}
                      onChange={(e) => {
                        const kind = e.target.value;
                        updateMapping(i, kind === "field" ? "field:name" : "static:");
                      }}
                      className={`${inputClass} max-w-[140px]`}
                    >
                      <option value="field">Contact field</option>
                      <option value="static">Fixed text</option>
                    </select>
                    {(mapping[String(i)] ?? "field:name").startsWith("field:") ? (
                      <select
                        value={mapping[String(i)]?.split(":")[1] ?? "name"}
                        onChange={(e) => updateMapping(i, `field:${e.target.value}`)}
                        className={inputClass}
                      >
                        <option value="name">Name</option>
                        <option value="phone">Phone</option>
                        <option value="email">Email</option>
                      </select>
                    ) : (
                      <input
                        placeholder="Fixed value for all recipients"
                        value={mapping[String(i)]?.split(":").slice(1).join(":") ?? ""}
                        onChange={(e) => updateMapping(i, `static:${e.target.value}`)}
                        className={inputClass}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Schedule <span className="text-zinc-400">(optional — leave blank to send now)</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Skip contacts messaged in the last <span className="text-zinc-400">(days, optional)</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 3"
                value={skipRecentDays}
                onChange={(e) => setSkipRecentDays(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Launching…" : scheduledAt ? "Schedule campaign" : "Send now"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Delivered</th>
              <th className="px-4 py-3 font-medium">Read</th>
              <th className="px-4 py-3 font-medium">Failed</th>
              <th className="px-4 py-3 font-medium">Replied</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initialCampaigns.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  No campaigns yet.
                </td>
              </tr>
            )}
            {initialCampaigns.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-3">
                  <a
                    href={`/campaigns/${c.id}`}
                    className="font-medium text-zinc-900 hover:text-emerald-600 hover:underline dark:text-zinc-50 dark:hover:text-emerald-400"
                  >
                    {c.name}
                  </a>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.template?.name ?? "—"} · {c.list?.name ?? "—"} · {c.totalRecipients} recipients
                    {c.sentCount > 0 && ` · ${((c.deliveredCount / c.sentCount) * 100).toFixed(0)}% delivered`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{c.sentCount}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{c.deliveredCount}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{c.readCount}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{c.failedCount}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{c.repliedCount}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDuplicate(c.id)}
                    disabled={duplicatingId === c.id}
                    className="text-xs font-medium text-zinc-400 hover:text-emerald-600 disabled:opacity-60 dark:hover:text-emerald-400"
                  >
                    {duplicatingId === c.id ? "Duplicating…" : "Duplicate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
