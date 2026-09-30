"use client";

import { useEffect, useState } from "react";
import { explainErrorCode } from "@/lib/whatsapp/error-codes";

export type ThreadRow = {
  id: string;
  name: string | null;
  phone: string;
  lastActivityAt: string;
  preview: string;
};

export type TemplateOption = {
  id: string;
  name: string;
  language: string;
  variableCount: number;
};

type MessageEvent = {
  id: string;
  eventType: string;
  metaMessageId: string | null;
  rawPayload: unknown;
  createdAt: string;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function bubbleText(e: MessageEvent): string {
  const p = e.rawPayload as Record<string, unknown>;
  if (e.eventType === "inbound") {
    if (p.type === "text" && (p.text as { body?: string })?.body) return (p.text as { body: string }).body;
    return `[${p.type ?? "message"}]`;
  }
  if (e.eventType === "outbound_template") return `Template: ${p.templateName ?? "—"}`;
  if (e.eventType === "outbound_failed") return `Failed to send: ${p.error ?? "unknown error"}`;
  return e.eventType.replace(/_/g, " ");
}

function isOutbound(e: MessageEvent): boolean {
  return e.eventType.startsWith("outbound");
}

export function InboxDashboard({
  threads,
  templates,
}: {
  threads: ThreadRow[];
  templates: TemplateOption[];
}) {
  const [selected, setSelected] = useState<ThreadRow | null>(threads[0] ?? null);
  const [events, setEvents] = useState<MessageEvent[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showRaw, setShowRaw] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [varValue, setVarValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (!selected) return;
    setLoadingThread(true);
    fetch(`/api/inbox/threads/${selected.id}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .finally(() => setLoadingThread(false));
  }, [selected]);

  async function handleSend() {
    if (!selected || !templateId) return;
    setSendError(null);
    setSendSuccess(false);
    setSendLoading(true);
    const res = await fetch("/api/inbox/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: selected.id,
        templateId,
        variableValues: varValue ? { "1": varValue } : {},
      }),
    });
    setSendLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSendError(data.error ?? "Could not send");
      return;
    }
    setSendSuccess(true);
    setVarValue("");
    const refreshed = await fetch(`/api/inbox/threads/${selected.id}`).then((r) => r.json());
    setEvents(refreshed.events ?? []);
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-50">No conversations yet</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Once someone messages your connected number, it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="w-64 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className={`block w-full border-b border-zinc-100 px-4 py-3 text-left dark:border-zinc-900 ${
              selected?.id === t.id ? "bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.name || t.phone}</div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">{t.preview}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col">
        {selected ? (
          <>
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="font-medium text-zinc-900 dark:text-zinc-50">{selected.name || selected.phone}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{selected.phone}</div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-900">
              {loadingThread && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}
              {!loadingThread && events.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No messages yet.</p>
              )}
              {events.map((e) => {
                const outbound = isOutbound(e);
                const errorInfo =
                  e.eventType === "failed" || e.eventType === "outbound_failed"
                    ? explainErrorCode(
                        String(
                          (e.rawPayload as { code?: string | number })?.code ??
                            (e.rawPayload as { errors?: Array<{ code: number }> })?.errors?.[0]?.code ??
                            ""
                        )
                      )
                    : null;
                return (
                  <div key={e.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-sm rounded-lg px-3 py-2 text-sm shadow-sm ${
                        outbound
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      }`}
                    >
                      <div>{bubbleText(e)}</div>
                      {errorInfo && (
                        <div className="mt-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-100">
                          {errorInfo.title}: {errorInfo.action}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className={`text-[10px] ${outbound ? "text-emerald-100" : "text-zinc-400"}`}>
                          {new Date(e.createdAt).toLocaleString()} · {e.eventType.replace(/_/g, " ")}
                        </span>
                        <button
                          onClick={() => setShowRaw(showRaw === e.id ? null : e.id)}
                          className={`text-[10px] underline ${outbound ? "text-emerald-100" : "text-zinc-400"}`}
                        >
                          Meta log
                        </button>
                      </div>
                      {showRaw === e.id && (
                        <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-black/80 p-2 text-[10px] text-emerald-300">
                          {JSON.stringify(e.rawPayload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                Send an approved template (only Meta-compliant method for messaging outside a live session)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${inputClass} max-w-[200px]`}>
                  {templates.length === 0 && <option value="">No approved templates</option>}
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {selectedTemplate && selectedTemplate.variableCount > 0 && (
                  <input
                    placeholder={`{{1}} value (defaults to name)`}
                    value={varValue}
                    onChange={(e) => setVarValue(e.target.value)}
                    className={`${inputClass} max-w-[180px]`}
                  />
                )}
                <button
                  onClick={handleSend}
                  disabled={sendLoading || !templateId}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {sendLoading ? "Sending…" : "Send"}
                </button>
              </div>
              {sendError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{sendError}</p>}
              {sendSuccess && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Sent.</p>}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}
