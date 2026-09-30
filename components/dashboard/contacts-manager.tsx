"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ContactRow = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  tags: string[] | null;
  optedOut: boolean;
  createdAt: string;
};

export type ListRow = {
  id: string;
  name: string;
  memberCount: number;
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function ContactsManager({
  initialContacts,
  initialLists,
}: {
  initialContacts: ContactRow[];
  initialLists: ListRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tags, setTags] = useState("");

  const [importListChoice, setImportListChoice] = useState<string>("__new__");
  const [newListName, setNewListName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignListChoice, setAssignListChoice] = useState<string>("__new__");
  const [assignNewListName, setAssignNewListName] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return initialContacts;
    const q = search.trim().toLowerCase();
    return initialContacts.filter(
      (c) =>
        c.phone.includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [initialContacts, search]);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        name: name || undefined,
        email: email || undefined,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      }),
    });
    setAddLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAddError(data.error ?? "Could not add contact");
      return;
    }
    setPhone("");
    setName("");
    setEmail("");
    setTags("");
    setShowAddForm(false);
    router.refresh();
  }

  async function handleToggleOptOut(contact: ContactRow) {
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optedOut: !contact.optedOut }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setImportError("Choose a CSV file first");
      return;
    }
    setImportLoading(true);
    const csv = await file.text();
    const res = await fetch("/api/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv,
        listId: importListChoice !== "__new__" && importListChoice !== "__none__" ? importListChoice : undefined,
        newListName: importListChoice === "__new__" ? newListName || undefined : undefined,
      }),
    });
    setImportLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setImportError(data.error ?? "Import failed");
      return;
    }
    const data = await res.json();
    setImportResult(`Imported ${data.imported}, updated ${data.updated}, skipped ${data.skipped}.`);
    router.refresh();
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }

  async function handleAssignToList() {
    setAssignError(null);
    setAssignResult(null);
    if (selectedIds.size === 0) {
      setAssignError("Select at least one contact first");
      return;
    }
    setAssignLoading(true);

    let listId = assignListChoice;
    if (assignListChoice === "__new__") {
      if (!assignNewListName.trim()) {
        setAssignLoading(false);
        setAssignError("Enter a name for the new list");
        return;
      }
      const createRes = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: assignNewListName.trim() }),
      });
      if (!createRes.ok) {
        setAssignLoading(false);
        const data = await createRes.json().catch(() => ({}));
        setAssignError(data.error ?? "Could not create list");
        return;
      }
      const created = await createRes.json();
      listId = created.list.id;
    }

    const res = await fetch(`/api/lists/${listId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactIds: Array.from(selectedIds) }),
    });
    setAssignLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAssignError(data.error ?? "Could not add contacts to list");
      return;
    }
    setAssignResult(`Added ${selectedIds.size} contact${selectedIds.size === 1 ? "" : "s"} to the list.`);
    setSelectedIds(new Set());
    setAssignNewListName("");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          placeholder="Search by name, phone, email, or tag"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Add contact
          </button>
        </div>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddContact}
          className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <input required placeholder="Phone (+countrycode)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          <input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
          <div className="sm:col-span-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={addLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {addLoading ? "Adding…" : "Add"}
            </button>
            {addError && <span className="text-sm text-red-600 dark:text-red-400">{addError}</span>}
          </div>
        </form>
      )}

      {showImport && (
        <form
          onSubmit={handleImport}
          className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">CSV file</label>
            <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
              Needs a header row with a <code>phone</code> column. Optional: <code>name</code>,{" "}
              <code>email</code>, <code>tags</code> (semicolon separated).
            </p>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add to list</label>
            <select
              value={importListChoice}
              onChange={(e) => setImportListChoice(e.target.value)}
              className={`${inputClass} mt-1 max-w-xs`}
            >
              <option value="__new__">Create new list</option>
              <option value="__none__">Don&apos;t add to a list</option>
              {initialLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.memberCount})
                </option>
              ))}
            </select>
            {importListChoice === "__new__" && (
              <input
                placeholder="New list name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className={`${inputClass} mt-2 max-w-xs`}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={importLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {importLoading ? "Importing…" : "Import"}
            </button>
            {importError && <span className="text-sm text-red-600 dark:text-red-400">{importError}</span>}
            {importResult && <span className="text-sm text-emerald-600 dark:text-emerald-400">{importResult}</span>}
          </div>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-500/10">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {selectedIds.size} selected
          </span>
          <select
            value={assignListChoice}
            onChange={(e) => setAssignListChoice(e.target.value)}
            className={`${inputClass} max-w-[220px] bg-white dark:bg-zinc-900`}
          >
            <option value="__new__">Create new list</option>
            {initialLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.memberCount})
              </option>
            ))}
          </select>
          {assignListChoice === "__new__" && (
            <input
              placeholder="New list name"
              value={assignNewListName}
              onChange={(e) => setAssignNewListName(e.target.value)}
              className={`${inputClass} max-w-[180px] bg-white dark:bg-zinc-900`}
            />
          )}
          <button
            onClick={handleAssignToList}
            disabled={assignLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {assignLoading ? "Adding…" : "Add to list"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear
          </button>
          {assignError && <span className="text-sm text-red-600 dark:text-red-400">{assignError}</span>}
          {assignResult && <span className="text-sm text-emerald-700 dark:text-emerald-400">{assignResult}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400">
                  {initialContacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelected(c.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">{c.name || c.phone}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.phone}
                    {c.email ? ` · ${c.email}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleOptOut(c)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.optedOut
                        ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                  >
                    {c.optedOut ? "Opted out" : "Subscribed"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
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

      {initialLists.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Lists</h3>
          <div className="flex flex-wrap gap-2">
            {initialLists.map((l) => (
              <span
                key={l.id}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
              >
                {l.name} <span className="text-zinc-400">({l.memberCount})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
