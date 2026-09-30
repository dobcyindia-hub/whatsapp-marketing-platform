import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { campaignQueue } from "@/lib/queue/campaign-queue";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const counts = await campaignQueue.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    return NextResponse.json({ ok: true, counts });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not reach the send queue (Redis unreachable)" }, { status: 502 });
  }
}
