import { NextResponse } from "next/server";
import { approveFollowUp, sendTest } from "@/lib/followup-actions";

export async function POST(_req: Request, ctx: { params: Promise<{ followUpId: string; action: string }> }) {
  const { followUpId, action } = await ctx.params;
  try {
    if (action === "approve") return NextResponse.json(await approveFollowUp(followUpId));
    if (action === "send-test") return NextResponse.json(await sendTest(followUpId));
    return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
