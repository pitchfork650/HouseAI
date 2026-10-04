import { prisma } from "./db";
import { DEFAULT_ROUTES } from "./config";
import type { NavItem } from "@/components/Sidebar";

/** Open findings on each patient's latest diagnostic run. */
export async function openFindingsCount(): Promise<number> {
  const runs = await prisma.swarmRun.findMany({
    where: { kind: "diagnostic", status: { not: "running" } },
    orderBy: { startedAt: "desc" },
    select: { id: true, patientId: true },
  });
  const latest = new Map<string, string>();
  for (const r of runs) if (!latest.has(r.patientId)) latest.set(r.patientId, r.id);
  return prisma.finding.count({ where: { runId: { in: [...latest.values()] }, status: "suggested" } });
}

/** Insurance lanes needing attention on each patient's latest insurance run. */
export async function lanesNeedingAttention(): Promise<number> {
  const runs = await prisma.swarmRun.findMany({ where: { kind: "insurance" }, orderBy: { startedAt: "desc" }, select: { id: true, patientId: true } });
  const latest = new Map<string, string>();
  for (const r of runs) if (!latest.has(r.patientId)) latest.set(r.patientId, r.id);
  return prisma.agentRun.count({ where: { runId: { in: [...latest.values()] }, status: { in: ["retry", "failed"] } } });
}

export async function navItems(): Promise<NavItem[]> {
  const [findings, lanes, nextFollowUp] = await Promise.all([
    openFindingsCount(),
    lanesNeedingAttention(),
    prisma.followUp.findFirst({ where: { status: { in: ["draft", "approved"] } }, orderBy: { scheduledFor: "asc" }, select: { id: true } }),
  ]);
  return [
    { key: "flow", label: "Flow", href: "/", icon: "flow", match: "/" },
    { key: "diagnostics", label: "Diagnostics", href: DEFAULT_ROUTES.diagnostics, icon: "scanNav", count: findings, countTone: "teal", match: "/diagnostics" },
    { key: "schedule", label: "Schedule", href: "/schedule", icon: "calendar", match: "/schedule" },
    { key: "insurance", label: "Insurance", href: DEFAULT_ROUTES.insurance, icon: "shieldCheck", count: lanes, countTone: "orange", match: "/insurance" },
    { key: "followups", label: "Follow-ups", href: nextFollowUp ? `/follow-ups/${nextFollowUp.id}` : DEFAULT_ROUTES.followUp, icon: "mail", match: "/follow-ups" },
  ];
}
