import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contacts, contactListMembers, contactLists } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { parseCsv, normalizePhone } from "@/lib/csv";
import { fireContactCreatedAutomations } from "@/lib/automations/engine";
import { and, eq } from "drizzle-orm";

const importSchema = z.object({
  csv: z.string().min(1),
  listId: z.string().uuid().optional(),
  newListName: z.string().min(1).max(255).optional(),
});

function findColumn(header: string[], candidates: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const rows = parseCsv(parsed.data.csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV appears to be empty" }, { status: 400 });
  }

  const [header, ...dataRows] = rows;
  const phoneIdx = findColumn(header, ["phone", "phone number", "mobile", "whatsapp"]);
  const nameIdx = findColumn(header, ["name", "full name"]);
  const emailIdx = findColumn(header, ["email", "email address"]);
  const tagsIdx = findColumn(header, ["tags", "tag"]);

  if (phoneIdx === -1) {
    return NextResponse.json(
      { error: "Could not find a phone column. Expected a header like 'phone' or 'mobile'." },
      { status: 400 }
    );
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const importedIds: string[] = [];

  for (const row of dataRows) {
    const rawPhone = row[phoneIdx]?.trim();
    if (!rawPhone) {
      skipped++;
      continue;
    }
    const phone = normalizePhone(rawPhone);
    if (phone.length < 6) {
      skipped++;
      continue;
    }
    const name = nameIdx !== -1 ? row[nameIdx]?.trim() || null : null;
    const email = emailIdx !== -1 ? row[emailIdx]?.trim() || null : null;
    const tags =
      tagsIdx !== -1 && row[tagsIdx]
        ? row[tagsIdx]
            .split(/[;|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    const existing = await db.query.contacts.findFirst({
      where: and(eq(contacts.teamId, session.teamId), eq(contacts.phone, phone)),
    });

    if (existing) {
      await db
        .update(contacts)
        .set({
          name: name ?? existing.name,
          email: email ?? existing.email,
          tags: tags.length > 0 ? Array.from(new Set([...(existing.tags ?? []), ...tags])) : existing.tags,
        })
        .where(eq(contacts.id, existing.id));
      importedIds.push(existing.id);
      updated++;
    } else {
      const [created] = await db
        .insert(contacts)
        .values({ teamId: session.teamId, phone, name, email, tags })
        .returning();
      importedIds.push(created.id);
      imported++;
      await fireContactCreatedAutomations(session.teamId, created);
    }
  }

  let listId = parsed.data.listId;
  if (!listId && parsed.data.newListName) {
    const [list] = await db
      .insert(contactLists)
      .values({ teamId: session.teamId, name: parsed.data.newListName })
      .returning();
    listId = list.id;
  }

  if (listId && importedIds.length > 0) {
    await db
      .insert(contactListMembers)
      .values(importedIds.map((contactId) => ({ listId: listId!, contactId })))
      .onConflictDoNothing();
  }

  return NextResponse.json({ imported, updated, skipped, listId });
}
