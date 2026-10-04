import { prisma } from "@/lib/db";
import { IntakeView } from "@/components/intake/IntakeView";

export default async function IntakePage({ searchParams }: { searchParams: Promise<{ added?: string; patient?: string }> }) {
  const sp = await searchParams;
  const patients = await prisma.patient.findMany({ where: { name: { not: "[NAME]" } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="font-mono text-[12px] tracking-[0.1em] text-muted">STEP 01 · 02</div>
        <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.01em]">Intake</h1>
        <p className="m-0 text-[14px] text-ink-2">Add one patient or a whole day at once. Drop in X-rays, intraoral photos and insurance cards; OCR fills the card fields and staff only confirm the low-confidence ones.</p>
      </div>
      {sp.added && sp.patient ? (
        <div role="status" className="rise rounded-[12px] bg-teal-tint px-4 py-3 text-[14px] font-semibold text-teal-dark">
          Added {sp.patient}. Drop in their X-rays and insurance card below.
        </div>
      ) : null}
      <IntakeView patients={patients} initialPatient={sp.patient} />
    </>
  );
}
