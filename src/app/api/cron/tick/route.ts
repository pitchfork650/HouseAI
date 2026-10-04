import { NextResponse } from "next/server";
import { tick } from "@/lib/scheduler";

/** Run one scheduler pass now (also runs every minute in-process). */
export async function POST() {
  return NextResponse.json(await tick());
}
