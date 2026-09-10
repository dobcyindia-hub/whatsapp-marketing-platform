"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type TemplateRow = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
  headerText: string | null;
  footerText: string | null;
  variableCount: number;
  rejectionReason: string | null;
};

export type WabaAccountOption = {
  id: string;
  displayName: string | null;
  displayPhoneNumber: string | null;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function statusColor(status: string) {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "pending":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    case "rejected":
    case "disabled":
      return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function renderPreview(bodyText: string): string {
  return bodyText.replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => `[Sample value ${n}]`);
}

export function TemplatesManager({
  initialTemplates,
  accounts,
}: {
  initialTemplates: TemplateRow[];
  accounts: WabaAccountOption[];
}) {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [category, setCategory] = useState("marketing");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const preview = useMemo(() => renderPreview(bodyText), [bodyText]);

  async function handleSync() {
    if (!selectedAccountId) return;
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    const res = await fetch("/api/templates/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wabaAccountId: selectedAccountId }),
    });
    setSyncing(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSyncError(data.error ?? "Sync failed");
      return;
    }
    const data = await res.json();
    setSyncMessage(`Synced ${data.synced} template${data.synced === 1 ? "" : "s"} from Meta.`);
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wabaAccountId: selectedAccountId,
        name,
        language,
        category,
        headerText: headerText || undefined,
        bodyText,
        footerText: footerText || undefined,
      }),
    });
    setCreateLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error ?? "Could not submit template");
      return;
    }
    setName("");
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setShowForm(false);
    router.refresh();
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          Connect a WhatsApp number first
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Templates are synced from and submitted to a specific WhatsApp Business Account.
        </p>
        <a
          href="/whatsapp"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Go to WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className={`${inputClass} max-w-xs`}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName || a.displayPhoneNumber || a.id}
            </option>
          ))}
        </select>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {syncing ? "Syncing…" : "Sync from Meta"}
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          New template
        </button>
      </div>

      {syncMessage && <p className="mb-3 text-sm text-emerald-600 dark:text-emerald-400">{syncMessage}</p>}
      {syncError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{syncError}</p>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-white p-5 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Template name <span className="text-zinc-400">(snake_case)</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                className={inputClass}
                placeholder="order_confirmation"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Language</label>
                <input required value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utility</option>
                  <option value="authentication">Authentication</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Header text <span className="text-zinc-400">(optional)</span>
              </label>
              <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Body <span className="text-zinc-400">use {"{{1}}"}, {"{{2}}"}… for variables</span>
              </label>
              <textarea
                required
                rows={5}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className={inputClass}
                placeholder={"Hi {{1}}, your order #{{2}} has shipped!"}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Footer text <span className="text-zinc-400">(optional)</span>
              </label>
              <input value={footerText} onChange={(e) => setFooterText(e.target.value)} className={inputClass} />
            </div>

            {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}

            <button
              type="submit"
              disabled={createLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {createLoading ? "Submitting…" : "Submit to Meta for approval"}
            </button>
          </div>

          <div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Preview</div>
            <div className="mt-2 rounded-2xl bg-[#e5ddd5] p-4 dark:bg-zinc-800">
              <div className="max-w-xs rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-zinc-900 dark:text-zinc-50">
                {headerText && <div className="mb-1 font-semibold">{headerText}</div>}
                <div className="whitespace-pre-wrap">{preview || "Your message body will appear here."}</div>
                {footerText && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{footerText}</div>}
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Variables</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {initialTemplates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  No templates yet. Sync from Meta or create a new one.
                </td>
              </tr>
            )}
            {initialTemplates.map((t) => (
              <tr key={t.id} className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">{t.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.language}</div>
                  <div className="mt-1 max-w-md truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {t.bodyText}
                  </div>
                  {t.rejectionReason && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">{t.rejectionReason}</div>
                  )}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">{t.category}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{t.variableCount}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor(t.status)}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
