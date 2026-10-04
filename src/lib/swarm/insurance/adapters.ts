import type { Clock } from "../clock";

/**
 * Carrier adapters. Every lane talks to its insurer through one of these; the
 * default implementations are mocks. Real portals / clearinghouses plug in here
 * (ask before adding paid integrations).
 */
export class PortalTimeoutError extends Error {
  constructor(public seconds: number) {
    super(`Portal timeout (${seconds} s)`);
    this.name = "PortalTimeoutError";
  }
}

export type Eligibility = { active: boolean; activeSince: string; annualMax: string; used: string };
export type Coverage = { code: string; label: string; pct: number; note?: string };

export interface CarrierAdapter {
  channel: "portal" | "phone";
  login(clock: Clock): Promise<void>;
  eligibility(clock: Clock): Promise<Eligibility>;
  coverage(clock: Clock, codes: string[]): Promise<{ items: Coverage[]; waitingPeriod: string }>;
  submitPreapproval(clock: Clock, packet: { narrative: string; attachments: string[] }): Promise<{ ref: string }>;
}

const PLACEHOLDER_ELIGIBILITY: Eligibility = { active: true, activeSince: "[DATE]", annualMax: "[$]", used: "[$]" };

const LABELS: Record<string, string> = { D2740: "crown", D6010: "implant", D2391: "composite", D3330: "root canal" };

/** A responsive carrier portal. */
export class MockPortal implements CarrierAdapter {
  channel: "portal" | "phone" = "portal";
  constructor(private pct: Record<string, { pct: number; note?: string }> = {}) {}
  async login(clock: Clock) { await clock.sleep(60_000); }
  async eligibility(clock: Clock) { await clock.sleep(120_000); return PLACEHOLDER_ELIGIBILITY; }
  async coverage(clock: Clock, codes: string[]) {
    await clock.sleep(300_000);
    return { items: codes.map((code) => ({ code, label: LABELS[code] ?? code, pct: this.pct[code]?.pct ?? 0.5, note: this.pct[code]?.note })), waitingPeriod: "none" };
  }
  async submitPreapproval(clock: Clock) { await clock.sleep(60_000); return { ref: "[#]" }; }
}

/** A portal that times out (seed mode simulates this for Carrier B). */
export class TimingOutPortal extends MockPortal {
  constructor(private timeoutSec = 30) { super(); }
  async login(clock: Clock): Promise<void> {
    await clock.sleep(30_000);
    await clock.sleep(this.timeoutSec * 1000);
    throw new PortalTimeoutError(this.timeoutSec);
  }
}

/** Phone-line fallback, only open from a given hour. */
export class MockPhoneLine extends MockPortal {
  channel: "portal" | "phone" = "phone";
  constructor(public opensAtHour = 14) { super(); }
}

export function adaptersFor(carrier: string): { primary: CarrierAdapter; fallback?: MockPhoneLine } {
  const simulateTimeout = process.env.MOCK_CARRIER_B_TIMEOUT !== "false";
  if (carrier === "Carrier B" && simulateTimeout) return { primary: new TimingOutPortal(30), fallback: new MockPhoneLine(14) };
  return {
    primary: new MockPortal({ D2740: { pct: 0.5 }, D6010: { pct: 0.5, note: "after pre-approval" } }),
    fallback: new MockPhoneLine(14),
  };
}
