import { NextResponse } from "next/server";
import { erasePatient } from "@/lib/gdpr";

/** GDPR erasure. Requires ?confirm=<patientId> so it can't be triggered by accident. */
export async function DELETE(req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  if (new URL(req.url).searchParams.get("confirm") !== patientId) {
    return NextResponse.json({ error: `Add ?confirm=${patientId} to erase this patient` }, { status: 400 });
  }
  if (!(await erasePatient(patientId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ erased: true });
}
