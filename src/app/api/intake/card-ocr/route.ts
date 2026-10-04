import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { saveFile } from "@/lib/storage";
import { assertMayUseModel, llmMode } from "@/lib/llm";
import { lowConfidenceFields, readInsuranceCard } from "@/lib/ocr";
import { now } from "@/lib/clock";

/** Upload an insurance card: stored encrypted, read by OCR + Gemini, returned for staff review. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const patientId = String(form.get("patientId") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Use PNG, JPEG or WebP" }, { status: 400 });
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return NextResponse.json({ error: "Pick a patient first" }, { status: 400 });
  const data = Buffer.from(await file.arrayBuffer());
  try {
    if (llmMode() === "gemini") assertMayUseModel(patient);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
  const fileUrl = await saveFile(patientId, data);
  const res = await readInsuranceCard({ mimeType: file.type, data }, false);
  const fields = Object.fromEntries(Object.entries(res.data.fields).map(([k, v]) => [k, { ...v, confirmed: v.confidence >= 0.8 }]));
  const scan = await prisma.documentScan.create({
    data: { patientId, kind: "insurance_card", fileUrl, fields: fields as Prisma.InputJsonValue, status: "needs_review", scannedAt: now() },
  });
  await audit({ actor: "Card OCR", action: "ocr.insurance_card", entity: "DocumentScan", entityId: scan.id, outputs: res.data, model: res.model });
  return NextResponse.json({ id: scan.id, fields, lowConfidence: lowConfidenceFields(res.data), model: res.model });
}
