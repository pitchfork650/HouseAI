import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { saveFile } from "@/lib/storage";
import { now } from "@/lib/clock";

const TYPES = ["pano", "bitewing", "pa", "cbct", "intraoral"];
const MIME = ["image/png", "image/jpeg", "image/webp"];

/** Upload an image. Stored encrypted at rest; only its reference goes in the DB. */
export async function POST(req: Request, ctx: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "pano");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!TYPES.includes(type)) return NextResponse.json({ error: "Unknown image type" }, { status: 400 });
  if (!MIME.includes(file.type)) return NextResponse.json({ error: "Use PNG, JPEG or WebP" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "File too large (20 MB max)" }, { status: 400 });
  if (!(await prisma.patient.findUnique({ where: { id: patientId } }))) return NextResponse.json({ error: "Unknown patient" }, { status: 404 });
  const fileUrl = await saveFile(patientId, Buffer.from(await file.arrayBuffer()));
  const study = await prisma.imagingStudy.create({ data: { patientId, type, takenAt: now(), fileUrl, mimeType: file.type } });
  await audit({ actor: "user:staff", action: "imaging.upload", entity: "ImagingStudy", entityId: study.id, details: { type } });
  return NextResponse.json({ id: study.id, type });
}
