import { NextResponse } from "next/server";
import { exportPatient } from "@/lib/gdpr";

/** GDPR export: download everything held about a patient. */
export async function GET(_req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  const data = await exportPatient(patientId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${patientId}-export.json"`, "cache-control": "no-store" },
  });
}
