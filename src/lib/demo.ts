import { prisma } from "./db";
import { DEFAULT_ROUTES } from "./config";

/**
 * The scan the demo leads with: the latest finished swarm read of the seeded
 * sample patient's generated X-ray, findings and all. Real scans (uploads and
 * imports) stay inside the app.
 */
export async function demoDiagnosticRun() {
  return prisma.swarmRun.findFirst({
    where: { kind: "diagnostic", status: { in: ["done", "partial"] }, study: { fileUrl: { startsWith: "synthetic:" } }, findings: { some: {} } },
    orderBy: { startedAt: "desc" },
    include: { agents: { orderBy: { order: "asc" } }, findings: { orderBy: { order: "asc" } }, study: true },
  });
}

/** Where "Diagnostics" opens: the demo scan's patient. */
export async function diagnosticsHref(): Promise<string> {
  const run = await demoDiagnosticRun();
  return run ? `/diagnostics/${run.patientId}` : DEFAULT_ROUTES.diagnostics;
}
