"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type TemplateRow = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  bodyText: string;
  headerType: string | null;
  headerText: string | null;
  footerText: string | null;
  buttons: Array<{ type: string; text: string; value?: string }> | null;
  variableCount: number;
  rejectionReason: string | null;
};

export type WabaAccountOption = {
  id: string;
  displayName: string | null;
  displayPhoneNumber: string | null;
};

type ButtonDraft = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; value: string };

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

const MEDIA_ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/3gpp",
  document: "application/pdf",
};

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
  const [headerType, setHeaderType] = useState<"none" | "text" | "image" | "video" | "document">("none");
  const [headerText, setHeaderText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
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

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: "QUICK_REPLY", text: "", value: "" }]);
  }
  function updateButton(index: number, patch: Partial<ButtonDraft>) {
    setButtons((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }
  function removeButton(index: number) {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setMediaError(null);

    let headerMediaHandle: string | undefined;
    if (headerType === "image" || headerType === "video" || headerType === "document") {
      if (!mediaFile) {
        setMediaError("Choose a file for this header type");
        return;
      }
      setMediaUploading(true);
      const mediaForm = new FormData();
      mediaForm.append("wabaAccountId", selectedAccountId);
      mediaForm.append("file", mediaFile);
      const mediaRes = await fetch("/api/templates/media", { method: "POST", body: mediaForm });
      setMediaUploading(false);
      if (!mediaRes.ok) {
        const data = await mediaRes.json().catch(() => ({}));
        setMediaError(data.error ?? "Media upload failed");
        return;
      }
      const mediaData = await mediaRes.json();
      headerMediaHandle = mediaData.handle;
    }

    setCreateLoading(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wabaAccountId: selectedAccountId,
        name,
        language,
        category,
        headerType,
        headerText: headerType === "text" ? headerText || undefined : undefined,
        headerMediaHandle,
        bodyText,
        footerText: footerText || undefined,
        buttons: buttons.length > 0 ? buttons.filter((b) => b.text) : undefined,
      }),
    });
    setCreateLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error ?? "Could not submit template");
      return;
    }
    setName("");
    setHeaderType("none");
    setHeaderText("");
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBodyText("");
    setFooterText("");
    setButtons([]);
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
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Header</label>
              <select
                value={headerType}
                onChange={(e) => {
                  setHeaderType(e.target.value as typeof headerType);
                  setMediaFile(null);
                  setMediaError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className={inputClass}
              >
                <option value="none">None</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document (PDF)</option>
              </select>
              {headerType === "text" && (
                <input
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="Header text"
                />
              )}
              {(headerType === "image" || headerType === "video" || headerType === "document") && (
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={MEDIA_ACCEPT[headerType]}
                    onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                    className="text-sm"
                  />
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Uploaded to Meta when you submit the template. Max 16MB.
                  </p>
                  {mediaError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{mediaError}</p>}
                </div>
              )}
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

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Buttons <span className="text-zinc-400">(optional, up to 3)</span>
                </label>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    + Add button
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {buttons.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={b.type}
                      onChange={(e) => updateButton(i, { type: e.target.value as ButtonDraft["type"], value: "" })}
                      className={`${inputClass} max-w-[130px]`}
                    >
                      <option value="QUICK_REPLY">Quick reply</option>
                      <option value="URL">Website URL</option>
                      <option value="PHONE_NUMBER">Call phone</option>
                    </select>
                    <input
                      placeholder="Button text"
                      value={b.text}
                      onChange={(e) => updateButton(i, { text: e.target.value })}
                      className={inputClass}
                    />
                    {b.type !== "QUICK_REPLY" && (
                      <input
                        placeholder={b.type === "URL" ? "https://…" : "+1234567890"}
                        value={b.value}
                        onChange={(e) => updateButton(i, { value: e.target.value })}
                        className={inputClass}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeButton(i)}
                      className="shrink-0 text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}

            <button
              type="submit"
              disabled={createLoading || mediaUploading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {mediaUploading ? "Uploading media…" : createLoading ? "Submitting…" : "Submit to Meta for approval"}
            </button>
          </div>

          <div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Preview</div>
            <div className="mt-2 rounded-2xl bg-[#e5ddd5] p-4 dark:bg-zinc-800">
              <div className="max-w-xs rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-zinc-900 dark:text-zinc-50">
                {headerType === "text" && headerText && <div className="mb-1 font-semibold">{headerText}</div>}
                {(headerType === "image" || headerType === "video" || headerType === "document") && (
                  <div className="mb-2 flex h-24 items-center justify-center rounded bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                    {mediaFile ? mediaFile.name : `${headerType} attachment`}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{preview || "Your message body will appear here."}</div>
                {footerText && <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{footerText}</div>}
                {buttons.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                    {buttons.map((b, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-center text-xs text-emerald-700 dark:border-zinc-700 dark:text-emerald-400"
                      >
                        {b.text || "Button"}
                      </div>
                    ))}
                  </div>
                )}
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
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t.language}
                    {t.headerType && t.headerType !== "TEXT" ? ` · ${t.headerType.toLowerCase()} header` : ""}
                    {t.buttons && t.buttons.length > 0 ? ` · ${t.buttons.length} button${t.buttons.length > 1 ? "s" : ""}` : ""}
                  </div>
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
