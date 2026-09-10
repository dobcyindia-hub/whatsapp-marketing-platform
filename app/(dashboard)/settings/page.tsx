import { PageHeader } from "@/components/dashboard/page-header";
import { getSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <div>
      <PageHeader title="Settings" description="Account, team, and workspace settings." />
      <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Account</div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Email</span>
            <span className="text-zinc-900 dark:text-zinc-50">{session?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
