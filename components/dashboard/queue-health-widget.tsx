"use client";

import { useEffect, useState } from "react";

type Counts = { waiting: number; active: number; delayed: number; completed: number; failed: number };

export function QueueHealthWidget() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/system/queue-health");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not load queue status");
        return;
      }
      setCounts(data.counts);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return (
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        Send queue status unavailable: {error}
      </div>
    );
  }
  if (!counts) return null;

  const tiles = [
    { label: "Waiting", value: counts.waiting, hint: "queued, not yet picked up" },
    { label: "Active", value: counts.active, hint: "being sent right now" },
    { label: "Delayed", value: counts.delayed, hint: "scheduled for later" },
    { label: "Failed", value: counts.failed, hint: "exhausted retries" },
  ];

  const stuck = counts.waiting > 0 && counts.active === 0;

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Send queue (live)</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.label}</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t.value}</div>
            <div className="text-xs text-zinc-400">{t.hint}</div>
          </div>
        ))}
      </div>
      {stuck && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {counts.waiting} message{counts.waiting === 1 ? " is" : "s are"} queued but nothing is actively sending —
          the worker process may be down. Check <code>pm2 status</code> on the server.
        </div>
      )}
    </div>
  );
}
