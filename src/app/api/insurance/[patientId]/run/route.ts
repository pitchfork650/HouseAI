import { NextResponse } from "next/server";
import { startInsuranceRun } from "@/lib/swarm/insurance/run";

export async function POST(_req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  try {
    return NextResponse.json({ runId: await startInsuranceRun(patientId) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
