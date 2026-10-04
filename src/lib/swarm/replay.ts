import { MOCK_SPECIALISTS, mockConsensus, mockSkeptic, mockVerifier } from "./diagnostic/mocks";
import type { Candidate } from "./diagnostic/schemas";

/**
 * Sample outputs keyed by agent slug and request context: the same data the in-app mock
 * replays. The reference MCP host server (host/server.ts) uses this in replay mode.
 */
const SPECIALIST_NAMES: Record<string, string> = {
  "caries-scout": "Caries Scout",
  "root-tip": "Root-Tip Agent",
  "third-molar": "Third-Molar Agent",
  "restoration-auditor": "Restoration Auditor",
  shade: "Shade Agent",
};

export function replayOutput(slug: string, context: Record<string, unknown>): unknown {
  if (SPECIALIST_NAMES[slug]) return MOCK_SPECIALISTS[SPECIALIST_NAMES[slug]]();
  switch (slug) {
    case "verifier":
      return mockVerifier((context.candidates ?? []) as Candidate[]);
    case "skeptic":
      return mockSkeptic((context.candidates ?? []) as Candidate[]);
    case "consensus":
      return mockConsensus((context.rows ?? []) as Parameters<typeof mockConsensus>[0]);
    case "carrier-eligibility":
      // Seed mode: Carrier B's portal times out; the phone line answers.
      if (context.carrier === "Carrier B" && context.channel !== "phone" && process.env.MOCK_CARRIER_B_TIMEOUT !== "false") return { status: "timeout", timeoutSec: 30 };
      return { status: "ok", activeSince: "[DATE]", annualMax: "[$]", used: "[$]" };
    case "carrier-coverage": {
      const labels: Record<string, string> = { D2740: "crown", D6010: "implant", D2391: "composite", D3330: "root canal" };
      const codes = (context.codes ?? []) as string[];
      return { items: codes.map((code) => ({ code, label: labels[code] ?? code, pct: 0.5, ...(code === "D6010" ? { note: "after pre-approval" } : {}) })), waitingPeriod: "none" };
    }
    case "carrier-preapproval":
      return { ref: "[#]" };
    case "preapproval-narrative": {
      const c = context as { procedure?: string; teeth?: number[]; attachments?: string[] };
      return { narrative: `Request for pre-authorization of ${c.procedure} at ${(c.teeth ?? []).map((t) => `#${t}`).join(", ")}. Attached: ${(c.attachments ?? []).join(", ")}.` };
    }
    default:
      throw new Error(`No replay output for agent "${slug}"`);
  }
}
