import { NextResponse } from "next/server";
import { tick } from "@/lib/scheduler";

/** Run one scheduler pass now (also runs every minute in-process). */
export async function POST() {
  return NextResponse.json(await tick());
}

/**
 * Vercel Cron (vercel.json). Serverless functions don't keep the in-process interval
 * alive, so production relies on this. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await tick());
}
