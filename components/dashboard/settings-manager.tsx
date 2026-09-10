"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function SettingsManager({ email, teamName }: { email: string; teamName: string }) {
  const router = useRouter();

  const [name, setName] = useState(teamName);
  const [teamSaving, setTeamSaving] = useState(false);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handleTeamSave(e: React.FormEvent) {
    e.preventDefault();
    setTeamSaving(true);
    setTeamMessage(null);
    const res = await fetch("/api/settings/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setTeamSaving(false);
    if (!res.ok) {
      setTeamMessage("Could not update workspace name");
      return;
    }
    setTeamMessage("Saved");
    router.refresh();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    setPwSaving(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setPwSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPwError(data.error ?? "Could not change password");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPwSuccess(true);
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Account</div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Email</span>
          <span className="text-zinc-900 dark:text-zinc-50">{email}</span>
        </div>
      </div>

      <form
        onSubmit={handleTeamSave}
        className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Workspace</div>
        <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">Workspace name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={teamSaving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {teamSaving ? "Saving…" : "Save"}
          </button>
          {teamMessage && <span className="text-sm text-zinc-500 dark:text-zinc-400">{teamMessage}</span>}
        </div>
      </form>

      <form
        onSubmit={handlePasswordChange}
        className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Change password</div>
        <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">Current password</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
        <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pwSaving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pwSaving ? "Updating…" : "Update password"}
          </button>
          {pwError && <span className="text-sm text-red-600 dark:text-red-400">{pwError}</span>}
          {pwSuccess && <span className="text-sm text-emerald-600 dark:text-emerald-400">Password updated</span>}
        </div>
      </form>
    </div>
  );
}
