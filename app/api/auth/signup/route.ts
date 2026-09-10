import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { teams, users } from "@/database/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

const signupSchema = z.object({
  teamName: z.string().min(2).max(255),
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { teamName, name, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const result = await db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ name: teamName }).returning();
    const [user] = await tx
      .insert(users)
      .values({
        teamId: team.id,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: "owner",
      })
      .returning();
    return { team, user };
  });

  await createSession({
    userId: result.user.id,
    teamId: result.team.id,
    email: result.user.email,
  });

  return NextResponse.json({ ok: true });
}
