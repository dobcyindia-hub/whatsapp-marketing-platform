import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { wabaAccounts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

const ratesSchema = z.object({
  currency: z.string().min(1).max(8),
  marketing: z.number().min(0).optional(),
  utility: z.number().min(0).optional(),
  authentication: z.number().min(0).optional(),
  service: z.number().min(0).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = ratesSchema.safeParse(body.conversationRates);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const [updated] = await db
    .update(wabaAccounts)
    .set({ conversationRates: parsed.data })
    .where(and(eq(wabaAccounts.id, id), eq(wabaAccounts.teamId, session.teamId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ account: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [deleted] = await db
    .delete(wabaAccounts)
    .where(and(eq(wabaAccounts.id, id), eq(wabaAccounts.teamId, session.teamId)))
    .returning({ id: wabaAccounts.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
