import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contacts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

const updateSchema = z.object({
  name: z.string().max(255).nullable().optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  tags: z.array(z.string()).optional(),
  optedOut: z.boolean().optional(),
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

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
