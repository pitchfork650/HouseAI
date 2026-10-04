/**
 * Rewrite a follow-up draft with the model (Gemini when GEMINI_API_KEY is set).
 *   npm run followup:draft            # Gavin Huang's demo follow-up (FU-1120)
 */
import { prisma } from "../src/lib/db";
import { draftFollowUp, GAVIN_FOLLOW_UP } from "../src/lib/followup-actions";

async function main() {
  const id = process.argv[2] ?? GAVIN_FOLLOW_UP.id;
  if (id !== GAVIN_FOLLOW_UP.id) throw new Error(`Only ${GAVIN_FOLLOW_UP.id} has visit notes on file for drafting.`);
  const patient = await prisma.patient.findUnique({ where: { id: GAVIN_FOLLOW_UP.patientId } });
  if (!patient) throw new Error(`Patient ${GAVIN_FOLLOW_UP.patientId} missing. Run npm run db:seed first.`);
  const fu = await draftFollowUp(GAVIN_FOLLOW_UP);
  console.log(`${fu.id} · ${fu.model} · ${fu.subject}`);
  console.log((fu.content as { intro: string }).intro);
}

main().finally(() => prisma.$disconnect());
