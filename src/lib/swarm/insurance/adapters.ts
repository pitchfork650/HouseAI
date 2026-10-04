import { z } from "zod";
import type { Clock } from "../clock";
import { invokeAgent, swarmHost } from "../host";
import { loadPrompt } from "../../prompts";
import { replayOutput } from "../replay";

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

export type PolicyInfo = { carrier: string; planName: string; rank: string; memberId?: string; groupNumber?: string };

const EligibilitySchema = z.object({
  status: z.enum(["ok", "timeout"]),
  timeoutSec: z.number().optional(),
  activeSince: z.string().optional(),
  annualMax: z.string().optional(),
  used: z.string().optional(),
});
const CoverageSchema = z.object({
  items: z.array(z.object({ code: z.string(), label: z.string(), pct: z.number().min(0).max(1), note: z.string().optional() })),
  waitingPeriod: z.string(),
});
const PreapprovalSchema = z.object({ ref: z.string() });

/** Carrier work done by OpenSwarm agents on the host, through the SwarmHost interface. */
export class HostCarrierAdapter implements CarrierAdapter {
  private elig: Eligibility | null = null;
  constructor(private policy: PolicyInfo, public channel: "portal" | "phone" = "portal") {}

  private call<T>(slug: string, schema: z.ZodType<T>, context: Record<string, unknown>) {
    const prompt = loadPrompt(slug);
    return invokeAgent({
      name: `${slug} · ${this.policy.carrier}`,
      slug,
      version: prompt.version,
      prompt: prompt.text,
      schema,
      context: { carrier: this.policy.carrier, planName: this.policy.planName, rank: this.policy.rank, memberId: this.policy.memberId, groupNumber: this.policy.groupNumber, channel: this.channel, ...context },
      mock: () => replayOutput(slug, { carrier: this.policy.carrier, channel: this.channel, ...context }) as T,
    });
  }

  async login() {
    const r = await this.call("carrier-eligibility", EligibilitySchema, {});
    if (r.data.status === "timeout") throw new PortalTimeoutError(r.data.timeoutSec ?? 30);
    this.elig = { active: true, activeSince: r.data.activeSince ?? "[DATE]", annualMax: r.data.annualMax ?? "[$]", used: r.data.used ?? "[$]" };
  }
  async eligibility() {
    if (!this.elig) await this.login();
    return this.elig!;
  }
  async coverage(_clock: Clock, codes: string[]) {
    return (await this.call("carrier-coverage", CoverageSchema, { codes })).data;
  }
  async submitPreapproval(_clock: Clock, packet: { narrative: string; attachments: string[] }) {
    return (await this.call("carrier-preapproval", PreapprovalSchema, { narrative: packet.narrative, attachments: packet.attachments })).data;
  }
}

/** Mock adapters by default; OpenSwarm agents when the real host is configured. */
export function adaptersFor(policy: PolicyInfo): { primary: CarrierAdapter; fallback?: MockPhoneLine } {
  if (swarmHost().kind === "openswarm") {
    return { primary: new HostCarrierAdapter(policy, "portal"), fallback: new MockPhoneLine(14) };
  }
  const simulateTimeout = process.env.MOCK_CARRIER_B_TIMEOUT !== "false";
  if (policy.carrier === "Carrier B" && simulateTimeout) return { primary: new TimingOutPortal(30), fallback: new MockPhoneLine(14) };
  return {
    primary: new MockPortal({ D2740: { pct: 0.5 }, D6010: { pct: 0.5, note: "after pre-approval" } }),
    fallback: new MockPhoneLine(14),
  };
}

/** Adapter for a scheduled phone-line retry. */
export function phoneAdapterFor(policy: PolicyInfo): CarrierAdapter {
  return swarmHost().kind === "openswarm" ? new HostCarrierAdapter(policy, "phone") : new MockPhoneLine(14);
}
