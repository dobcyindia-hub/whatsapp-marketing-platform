"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type WabaAccountSummary = {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  displayName: string | null;
  status: string;
  messagingTier: string | null;
  webhookVerifyToken: string;
  lastSyncedAt: string | null;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function WhatsAppManager({
  accounts,
  webhookOrigin,
}: {
  accounts: WabaAccountSummary[];
  webhookOrigin: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(accounts.length === 0);
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appId, setAppId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/whatsapp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wabaId, phoneNumberId, accessToken, appId: appId || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not connect this number");
      return;
    }
    setWabaId("");
    setPhoneNumberId("");
    setAccessToken("");
    setAppId("");
    setShowForm(false);
    router.refresh();
  }

  async function handleDisconnect(id: string) {
    setDisconnectingId(id);
    await fetch(`/api/whatsapp/${id}`, { method: "DELETE" });
    setDisconnectingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {account.displayName || "WhatsApp number"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        account.status === "connected"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                      }`}
                    >
                      {account.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {account.displayPhoneNumber ?? "—"} · tier {account.messagingTier ?? "unknown"}
                  </div>
                </div>
                <button
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnectingId === account.id}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400"
                >
                  {disconnectingId === account.id ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>

              <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                <div className="font-medium text-zinc-700 dark:text-zinc-300">
                  Meta webhook configuration
                </div>
                <div className="mt-2 space-y-1 font-mono text-zinc-500 dark:text-zinc-400">
                  <div>Callback URL: {webhookOrigin}/api/webhooks/whatsapp</div>
                  <div>Verify token: {account.webhookVerifyToken}</div>
                </div>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                  Paste these into your Meta App Dashboard → WhatsApp → Configuration → Webhooks,
                  and subscribe to the <code>messages</code> field.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form
          onSubmit={handleConnect}
          className="max-w-lg rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Connect a WhatsApp Cloud API number
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Requires a WhatsApp Business Account and a System User access token from your Meta App
            Dashboard.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                WhatsApp Business Account ID
              </label>
              <input required value={wabaId} onChange={(e) => setWabaId(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Phone Number ID</label>
              <input
                required
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Access Token (System User, permanent)
              </label>
              <input
                required
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Meta App ID <span className="text-zinc-400">(optional)</span>
              </label>
              <input value={appId} onChange={(e) => setAppId(e.target.value)} className={inputClass} />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Connecting…" : "Connect"}
            </button>
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Connect another number
        </button>
      )}
    </div>
  );
}
