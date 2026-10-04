import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  dob: z.string().trim().max(20).optional().default(""),
  email: z.string().trim().max(120).optional().default(""),
  allergies: z.string().trim().max(200).optional().default(""),
  consents: z.object({ treatment: z.boolean(), ai_analysis: z.boolean(), marketing_email: z.boolean() }),
});

async function nextPatientId() {
  const all = await prisma.patient.findMany({ select: { id: true } });
  const max = Math.max(1000, ...all.map((p) => Number(p.id.replace(/\D/g, "")) || 0));
  return `P-${max + 1}`;
}

/** Add one patient with consent per purpose. Real intake data is never sent to a model outside production. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid form" }, { status: 400 });
  const b = parsed.data;
  const id = await nextPatientId();
  const initials = b.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  await prisma.patient.create({
    data: {
      id,
      name: b.name,
      initials,
      dob: b.dob || null,
      email: b.email || null,
      allergies: b.allergies ? b.allergies.split(",").map((a) => a.trim()).filter(Boolean) : [],
      flags: [],
      synthetic: false,
      consents: { create: (Object.keys(b.consents) as (keyof typeof b.consents)[]).map((purpose) => ({ purpose, granted: b.consents[purpose] })) },
    },
  });
  await audit({ actor: "user:staff", action: "patient.create", entity: "Patient", entityId: id, details: { consents: b.consents } });
  return NextResponse.json({ id });
}
