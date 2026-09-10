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

export type WabaAccountOption = {
  id: string;
  displayName: string | null;
  displayPhoneNumber: string | null;
};

export type AutomationRow = {
  id: string;
  name: string;
  trigger: string;
  triggerConfig: Record<string, unknown> | null;
  isActive: boolean;
  template: { name: string } | null;
  wabaAccount: { displayName: string | null; displayPhoneNumber: string | null } | null;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

const TRIGGER_LABELS: Record<string, string> = {
  contact_created: "New contact added",
  keyword_reply: "Inbound message contains keyword",
  opt_in: "Contact re-subscribes (opt-in)",
};

export function AutomationsManager({
  initialAutomations,
  templates,
  accounts,
}: {
  initialAutomations: AutomationRow[];
  templates: TemplateOption[];
  accounts: WabaAccountOption[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [wabaAccountId, setWabaAccountId] = useState(accounts[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [trigger, setTrigger] = useState<"contact_created" | "keyword_reply" | "opt_in">("contact_created");
  const [keyword, setKeyword] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accountTemplates = useMemo(
    () => templates.filter((t) => t.wabaAccountId === wabaAccountId),
    [templates, wabaAccountId]
  );
  const selectedTemplate = useMemo(() => accountTemplates.find((t) => t.id === templateId), [accountTemplates, templateId]);
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
    if (!templateId) {
      setError("Choose a template");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        wabaAccountId,
        templateId,
        trigger,
        keyword: trigger === "keyword_reply" ? keyword : undefined,
        variableMapping: mapping,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create automation");
      return;
    }
    setName("");
    setKeyword("");
    setMapping({});
    setShowForm(false);
    router.refresh();
  }

  async function handleToggle(automation: AutomationRow) {
    await fetch(`/api/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !automation.isActive }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (accounts.length === 0 || templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          Connect a number and approve a template first
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Automations send an approved template when a rule fires.
        </p>
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
          New automation
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Automation name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">WhatsApp number</label>
              <select
                value={wabaAccountId}
                onChange={(e) => {
                  setWabaAccountId(e.target.value);
                  setTemplateId("");
                }}
                className={inputClass}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName || a.displayPhoneNumber || a.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Trigger</label>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as typeof trigger)}
                className={inputClass}
              >
                <option value="contact_created">New contact added</option>
                <option value="keyword_reply">Inbound message contains keyword</option>
                <option value="opt_in">Contact re-subscribes (opt-in)</option>
              </select>
            </div>
          </div>

          {trigger === "keyword_reply" && (
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Keyword</label>
              <input
                required
                placeholder="e.g. info"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className={`${inputClass} max-w-xs`}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Fires when an inbound message contains this word (case-insensitive).
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Template to send</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
              <option value="">Select a template</option>
              {accountTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </option>
              ))}
            </select>
            {accountTemplates.length === 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                No approved templates for this number yet.
              </p>
            )}
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
                        placeholder="Fixed value"
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

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create automation"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3 font-medium">Automation</th>
              <th className="px-4 py-3 font-medium">Trigger</th>
              <th className="px-4 py-3 font-medium">Sends</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initialAutomations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  No automations yet.
                </td>
              </tr>
            )}
            {initialAutomations.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{a.name}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {TRIGGER_LABELS[a.trigger] ?? a.trigger}
                  {a.trigger === "keyword_reply" && a.triggerConfig?.keyword ? (
                    <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                      &quot;{String(a.triggerConfig.keyword)}&quot;
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{a.template?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(a)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {a.isActive ? "Active" : "Paused"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs font-medium text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Delete
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
