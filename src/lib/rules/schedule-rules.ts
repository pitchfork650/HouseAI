/** Active scheduling rules. Each one is shown as a chip on the Schedule screen. */
export const SCHEDULE_RULES = {
  dayStart: 8 * 60,
  dayEnd: 17 * 60,
  lunch: { start: 12 * 60, end: 13 * 60 },
  longCaseMin: 90,
  noon: 12 * 60,
  hold: { start: 11 * 60, end: 11 * 60 + 30, releaseAt: 10 * 60 + 30 },
  insuranceLeadHours: 48,
  xrayMaxAgeMonths: 12,
};

export function ruleChips(r = SCHEDULE_RULES): string[] {
  return [
    `Long cases (${r.longCaseMin} min or more) before noon`,
    "Hold one P1 emergency slot a day",
    "Checkups fill the afternoon gaps",
    `Insurance verified at least ${r.insuranceLeadHours} h before`,
  ];
}

export function holdMeta(r = SCHEDULE_RULES): string {
  const h = Math.floor(r.hold.releaseAt / 60);
  const m = String(r.hold.releaseAt % 60).padStart(2, "0");
  return `Released at ${h}:${m} if unused`;
}
