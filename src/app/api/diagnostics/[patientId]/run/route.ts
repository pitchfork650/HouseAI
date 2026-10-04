import { NextResponse } from "next/server";
import { startDiagnosticRun } from "@/lib/swarm/diagnostic/run";

export async function POST(_req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  try {
    const runId = await startDiagnosticRun(patientId);
    return NextResponse.json({ runId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
