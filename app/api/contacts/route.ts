import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { contacts } from "@/database/schema";
import { getSession } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/csv";
import { fireContactCreatedAutomations } from "@/lib/automations/engine";
import { and, desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.contacts.findMany({
    where: eq(contacts.teamId, session.teamId),
    orderBy: desc(contacts.createdAt),
  });

  return NextResponse.json({ contacts: rows });
}

const createSchema = z.object({
  phone: z.string().min(6),
  name: z.string().max(255).optional(),
  email: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { phone, name, email, tags } = parsed.data;
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 6) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const existing = await db.query.contacts.findFirst({
    where: and(eq(contacts.teamId, session.teamId), eq(contacts.phone, normalizedPhone)),
  });
  if (existing) {
    return NextResponse.json({ error: "A contact with this phone number already exists" }, { status: 409 });
  }

  const [contact] = await db
    .insert(contacts)
    .values({
      teamId: session.teamId,
      phone: normalizedPhone,
      name: name || null,
      email: email || null,
      tags: tags ?? [],
    })
    .returning();

  await fireContactCreatedAutomations(session.teamId, contact);

  return NextResponse.json({ contact });
}
