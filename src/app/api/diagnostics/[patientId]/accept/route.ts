import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptFindings } from "@/lib/treatment";
import { latestRunId } from "@/lib/views";

const Body = z.object({ runId: z.string().optional(), findingIds: z.array(z.string()).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  const body = Body.parse(await req.json().catch(() => ({})));
  const runId = body.runId ?? (await latestRunId(patientId, "diagnostic"));
  if (!runId) return NextResponse.json({ error: "No diagnostic run for this patient." }, { status: 404 });
  return NextResponse.json(await acceptFindings(runId, "user:dentist", body.findingIds));
}
