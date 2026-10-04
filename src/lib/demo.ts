import { prisma } from "./db";
import { DEFAULT_ROUTES } from "./config";

/**
 * The scan the demo leads with: the latest finished diagnostic run on a real
 * X-ray (an uploaded or imported image), falling back to the seeded sample
 * patient when no real scan exists yet.
 */
export async function demoDiagnosticRun() {
  const include = { agents: { orderBy: { order: "asc" as const } }, findings: { orderBy: { order: "asc" as const } }, study: true };
  const real = await prisma.swarmRun.findFirst({
    where: { kind: "diagnostic", status: { in: ["done", "partial"] }, study: { fileUrl: { startsWith: "storage:" } }, findings: { some: {} } },
    orderBy: { startedAt: "desc" },
    include,
  });
  if (real) return { run: real, real: true as const };
  const sample = await prisma.swarmRun.findFirst({ where: { kind: "diagnostic", status: { in: ["done", "partial"] } }, orderBy: { startedAt: "desc" }, include });
  return { run: sample, real: false as const };
}

/** Where "Diagnostics" opens: the demo scan's patient. */
export async function diagnosticsHref(): Promise<string> {
  const { run } = await demoDiagnosticRun();
  return run ? `/diagnostics/${run.patientId}` : DEFAULT_ROUTES.diagnostics;
}
