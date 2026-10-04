import { describe, expect, it } from "vitest";
import { MemoryRunStore, registerAgents, runPhase, type AgentSpec } from "@/lib/swarm/coordinator";
import { VirtualClock } from "@/lib/swarm/clock";
import { MockPhoneLine, MockPortal, TimingOutPortal } from "@/lib/swarm/insurance/adapters";
import { copayLane, eligibilityLane, explainRun, nextPhoneSlot, preapprovalLane, type LaneInput } from "@/lib/swarm/insurance/lanes";
import { costSplit, patientAmount } from "@/lib/swarm/insurance/cost";

const t = (iso: string) => Date.parse(iso);
const hhmm = (s: string) => s.slice(11, 16);

describe("insurance swarm lanes", () => {
  it("keeps lanes independent: Carrier B times out while A, copay and pre-approval finish", async () => {
    const store = new MemoryRunStore();
    const A = { id: "a", carrier: "Carrier A", planName: "New employer PPO", rank: "primary" as const, channel: "portal" };
    const B = { id: "b", carrier: "Carrier B", planName: "Spouse plan (secondary)", rank: "secondary" as const, channel: "portal" };
    const portal = new MockPortal({ D6010: { pct: 0.5, note: "after pre-approval" } });
    const lanes = [
      eligibilityLane(A, portal),
      eligibilityLane(B, new TimingOutPortal(30), new MockPhoneLine(14)),
      copayLane(A, portal, ["D2740", "D6010"]),
      preapprovalLane({ code: "D6010", title: "Implant #19", teeth: [19] }, [], ["pano", "bitewing"], portal),
    ] as AgentSpec<LaneInput, unknown>[];
    const ids = await registerAgents(store, lanes);
    const out = await runPhase(store, ids, lanes, { clock: new VirtualClock(t("2026-10-04T09:40:00Z")), forceMock: true });

    expect(out.map((o) => o.badge)).toEqual(["Verified", "Retry 14:00", "Verified", "Submitted"]);
    const log = (name: string) => store.byName(name)!.log.map((l) => `${hhmm(l.t)} ${l.text}`);
    expect(log("Eligibility · Carrier A")).toEqual(["09:41 Portal login ok", "09:43 Active since [DATE]", "09:44 Annual max [$], [$] used"]);
    expect(log("Eligibility · Carrier B")).toEqual(["09:41 Portal timeout (30 s)", "09:46 Timeout again", "09:47 Next try: phone line at 14:00"]);
    expect(log("Copay Chaser")).toEqual(["09:45 D2740 crown: 50%", "09:45 D6010 implant: 50% after pre-approval", "09:46 Waiting period: none"]);
    expect(log("Pre-approval Agent")).toEqual(["09:48 Narrative from swarm findings", "09:49 Attached pano + bitewings", "09:50 Submitted · ref [#]"]);
  });

  it("explains the run from lane outcomes", () => {
    expect(
      explainRun([
        { name: "Eligibility · Carrier A", status: "verified", carrier: "Carrier A" },
        { name: "Eligibility · Carrier B", status: "retry", carrier: "Carrier B" },
        { name: "Copay Chaser", status: "verified" },
        { name: "Pre-approval Agent", status: "submitted" },
      ]),
    ).toBe("Carrier B's portal timed out, so only that lane is retrying. Carrier A's result and the pre-approval went through unaffected.");
  });

  it("schedules the phone retry for the next opening", () => {
    expect(nextPhoneSlot(new Date("2026-10-04T09:47:00Z"), 14).toISOString()).toBe("2026-10-04T14:00:00.000Z");
    expect(nextPhoneSlot(new Date("2026-10-04T15:00:00Z"), 14).toISOString()).toBe("2026-10-05T14:00:00.000Z");
  });

  it("splits cost by coordination of benefits", () => {
    expect(costSplit(0.5, 0.5)).toEqual({ primary: 0.5, secondary: 0.25, patient: 0.25 });
    expect(costSplit(0.8, null)).toEqual({ primary: 0.8, secondary: 0, patient: 0.2 });
    expect(patientAmount(null, costSplit(0.5, 0.5))).toBe("[$ AMOUNT]");
    expect(patientAmount(1000, costSplit(0.5, 0.5))).toBe("$250.00");
  });
});
