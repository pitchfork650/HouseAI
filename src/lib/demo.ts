import { prisma } from "./db";
import { DEFAULT_ROUTES } from "./config";

/** Image licences that allow use on the public (commercial) marketing site. */
const PUBLIC_LICENSES = ["CC BY 4.0", "CC0"];

/**
 * The scan the demo leads with: the latest finished diagnostic run on a real
 * X-ray (an uploaded or imported image), falling back to the seeded sample
 * patient when no real scan exists yet.
 *
 * `publicSite`: only images whose recorded source licence allows commercial use.
 * Clinic uploads (no source) are patient data and never qualify, and
 * non-commercial datasets (CC BY-NC) stay inside the app.
 */
export async function demoDiagnosticRun(opts: { publicSite?: boolean } = {}) {
  const include = { agents: { orderBy: { order: "asc" as const } }, findings: { orderBy: { order: "asc" as const } }, study: true };
  const licensed = opts.publicSite ? { OR: PUBLIC_LICENSES.map((l) => ({ source: { contains: l } })) } : {};
  const real = await prisma.swarmRun.findFirst({
    where: { kind: "diagnostic", status: { in: ["done", "partial"] }, study: { fileUrl: { startsWith: "storage:" }, ...licensed }, findings: { some: {} } },
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
