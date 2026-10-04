import { z } from "zod";
import { invokeAgent } from "../host";
import { loadPrompt } from "../../prompts";
import { hhmm } from "../../clock";
import type { AgentOutcome, AgentSpec } from "../coordinator";
import type { Clock } from "../clock";
import { PortalTimeoutError, type CarrierAdapter, type Coverage, type MockPhoneLine } from "./adapters";

export type PolicyRef = { id: string; carrier: string; planName: string; rank: "primary" | "secondary"; channel: string };

export type LaneInput = { clock: Clock; forceMock: boolean };

export type EligibilityOutput = { carrier: string; rank: string; active?: boolean; activeSince?: string; annualMax?: string; used?: string; channel: string };
export type CopayOutput = { carrier: string; items: Coverage[]; waitingPeriod: string };
export type PreapprovalOutput = { ref: string; narrative: string; attachments: string[]; procedure: string };

/** Next time the phone line is open, on the lane's own timeline. */
export function nextPhoneSlot(now: Date, opensAtHour: number): Date {
  const d = new Date(now);
  d.setUTCHours(opensAtHour, 0, 0, 0);
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * One eligibility lane per insurer. A portal timeout is retried once; if it times
 * out again the lane schedules a phone-line retry and reports "Retry HH:MM". It
 * never throws, so it can't block the other lanes.
 */
export function eligibilityLane(policy: PolicyRef, adapter: CarrierAdapter, fallback?: MockPhoneLine, retryWaitMs = 270_000): AgentSpec<LaneInput, EligibilityOutput> {
  return {
    name: `Eligibility · ${policy.carrier}`,
    scope: `${policy.planName} · ${policy.channel}`,
    timeoutMs: 120_000,
    retries: 0,
    async run(input, ctx) {
      const clock = input.clock.fork();
      const log = (t: string) => ctx.log(t, clock.now());
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await adapter.login(clock);
          log(`${adapter.channel === "phone" ? "Phone line" : "Portal"} login ok`);
          const e = await adapter.eligibility(clock);
          log(`Active since ${e.activeSince}`);
          await clock.sleep(60_000);
          log(`Annual max ${e.annualMax}, ${e.used} used`);
          return { status: "verified", badge: "Verified", result: `Active since ${e.activeSince}`, output: { carrier: policy.carrier, rank: policy.rank, ...e, channel: adapter.channel } };
        } catch (err) {
          if (!(err instanceof PortalTimeoutError)) throw err;
          log(attempt === 1 ? `Portal timeout (${err.seconds} s)` : "Timeout again");
          if (attempt === 1) await clock.sleep(retryWaitMs);
        }
      }
      await clock.sleep(30_000);
      const next = nextPhoneSlot(clock.now(), fallback?.opensAtHour ?? 14);
      log(`Next try: phone line at ${hhmm(next)}`);
      return {
        status: "retry",
        badge: `Retry ${hhmm(next)}`,
        result: "Portal timed out twice; phone-line retry scheduled.",
        nextAttemptAt: next,
        output: { carrier: policy.carrier, rank: policy.rank, channel: "phone" },
      };
    },
  };
}

/** Re-run a retrying eligibility lane through the phone line. */
export function phoneRetryLane(policy: PolicyRef, phone: MockPhoneLine): AgentSpec<LaneInput, EligibilityOutput> {
  return eligibilityLane({ ...policy }, phone);
}

export function copayLane(policy: PolicyRef, adapter: CarrierAdapter, codes: string[]): AgentSpec<LaneInput, CopayOutput> {
  return {
    name: "Copay Chaser",
    scope: "Coverage % by procedure code",
    timeoutMs: 120_000,
    retries: 1,
    async run(input, ctx) {
      const clock = input.clock.fork();
      const cov = await adapter.coverage(clock, codes);
      for (const c of cov.items) ctx.log(`${c.code} ${c.label}: ${Math.round(c.pct * 100)}%${c.note ? ` ${c.note}` : ""}`, clock.now());
      await clock.sleep(60_000);
      ctx.log(`Waiting period: ${cov.waitingPeriod}`, clock.now());
      return { status: "verified", badge: "Verified", result: cov.items.map((c) => `${c.code} ${Math.round(c.pct * 100)}%`).join(", "), output: { carrier: policy.carrier, ...cov } };
    },
  };
}

export function preapprovalLane(
  procedure: { code: string; title: string; teeth: number[] },
  findings: string[],
  studyTypes: string[],
  adapter: CarrierAdapter,
): AgentSpec<LaneInput, PreapprovalOutput> {
  const toothLabel = procedure.teeth.map((t) => `#${t}`).join(", ");
  return {
    name: "Pre-approval Agent",
    scope: `${procedure.title} · attaches X-rays`,
    timeoutMs: 120_000,
    retries: 1,
    async run(input, ctx) {
      const clock = input.clock.fork();
      const prompt = loadPrompt("preapproval-narrative");
      await clock.sleep(480_000);
      const res = await invokeAgent({
        name: "Pre-approval Agent",
        slug: "preapproval-narrative",
        version: prompt.version,
        prompt: prompt.text,
        schema: z.object({ narrative: z.string().min(1) }),
        context: { procedure: procedure.code, teeth: procedure.teeth, findings, attachments: studyTypes },
        mock: () => ({ narrative:
          `Request for pre-authorization of ${procedure.code} (${procedure.title.toLowerCase()}) at ${toothLabel}. ` +
          (findings.length ? `Findings: ${findings.join("; ")}. ` : "") +
          `Attached: ${studyTypes.join(", ")}.` }),
        forceMock: input.forceMock,
        signal: ctx.signal,
      });
      ctx.log("Narrative from swarm findings", clock.now());
      await clock.sleep(60_000);
      const att = attachmentLabel(studyTypes);
      ctx.log(`Attached ${att}`, clock.now());
      const { ref } = await adapter.submitPreapproval(clock, { narrative: res.data.narrative, attachments: studyTypes });
      ctx.log(`Submitted · ref ${ref}`, clock.now());
      return {
        status: "submitted",
        badge: "Submitted",
        result: `Submitted · ref ${ref}`,
        output: { ref, narrative: res.data.narrative, attachments: studyTypes, procedure: procedure.code },
        model: res.model,
        promptVersion: prompt.version,
      } satisfies AgentOutcome<PreapprovalOutput>;
    },
  };
}

function attachmentLabel(types: string[]): string {
  const names: Record<string, string> = { pano: "pano", bitewing: "bitewings", pa: "PA film", cbct: "CBCT", intraoral: "photos" };
  const order = Object.keys(names);
  const uniq = [...new Set(types)].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((t) => names[t] ?? t);
  return uniq.join(" + ");
}

/** "Why a swarm and not a script": generated from what actually happened in the run. */
export function explainRun(lanes: { name: string; status: string; carrier?: string }[]): string {
  const stuck = lanes.filter((l) => l.status === "retry" || l.status === "failed");
  const ok = lanes.filter((l) => l.status === "verified" || l.status === "submitted");
  if (!stuck.length) return "Every lane finished independently; the coordinator merged all results.";
  const stuckCarrier = stuck.map((l) => l.carrier ?? l.name).join(" and ");
  const okEligibility = ok.filter((l) => l.carrier && l.name.startsWith("Eligibility")).map((l) => `${l.carrier}'s result`);
  const pre = ok.some((l) => l.name === "Pre-approval Agent") ? ["the pre-approval"] : [];
  const unaffected = [...okEligibility, ...pre];
  const first = `${stuckCarrier}'s portal timed out, so only that lane is retrying.`;
  if (!unaffected.length) return first;
  const joined = unaffected.length > 1 ? `${unaffected.slice(0, -1).join(", ")} and ${unaffected[unaffected.length - 1]}` : unaffected[0];
  return `${first} ${joined[0].toUpperCase()}${joined.slice(1)} went through unaffected.`;
}
