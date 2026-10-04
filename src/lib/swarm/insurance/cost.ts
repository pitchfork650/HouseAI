/**
 * Coordination of benefits (estimate). The primary pays its coverage % of the fee;
 * the secondary pays its % of the remaining balance; the patient pays the rest.
 * While the secondary is unverified, its plan's nominal share is shown as pending.
 */
export type CostSplit = { primary: number; secondary: number; patient: number };

export function costSplit(primaryPct: number, secondaryPctOfRemainder: number | null): CostSplit {
  const p = clamp(primaryPct);
  const remainder = 1 - p;
  const s = remainder * clamp(secondaryPctOfRemainder ?? 0);
  return { primary: round(p), secondary: round(s), patient: round(1 - p - s) };
}

/** Patient amount, or the literal placeholder while the fee isn't set. */
export function patientAmount(fee: number | null, split: CostSplit): string {
  if (fee == null) return "[$ AMOUNT]";
  return `$${(fee * split.patient).toFixed(2)}`;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const round = (x: number) => Math.round(x * 10_000) / 10_000;
