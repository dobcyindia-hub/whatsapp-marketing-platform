import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contacts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { fireOptInAutomations } from "@/lib/automations/engine";
import { and, eq } from "drizzle-orm";

const updateSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  tags: z.array(z.string()).optional(),
  optedOut: z.boolean().optional(),
  notes: z.string().max(4096).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { optedOut, ...rest } = parsed.data;

  const before = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), eq(contacts.teamId, session.teamId)),
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(contacts)
    .set({
      ...rest,
      ...(optedOut !== undefined
        ? { optedOut, optedOutAt: optedOut ? new Date() : null }
        : {}),
    })
    .where(and(eq(contacts.id, id), eq(contacts.teamId, session.teamId)))
    .returning();

  if (before.optedOut && optedOut === false) {
    await fireOptInAutomations(session.teamId, updated);
  }

  return NextResponse.json({ contact: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [deleted] = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.teamId, session.teamId)))
    .returning({ id: contacts.id });

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
