import { z, type ZodType } from "zod";
import type { ImagePart } from "../../llm";
import { audit, hash } from "../../audit";
import { MockSwarmHost } from "./mock";
import { OpenSwarmHost, validateHostUrl } from "./openswarm";

/**
 * Every swarm agent call goes through a SwarmHost. Two versions:
 *  - MockSwarmHost replays the sample runs (default until the host is set up)
 *  - OpenSwarmHost runs agents on the OpenSwarm host device over HTTPS / a private tunnel
 * Agent definitions (prompt + expected output format) live in this repo and are sent
 * with every request; every result is validated against that format here.
 */
export type AgentDefinition = {
  name: string;
  slug: string;
  version: string;
  prompt: string;
  outputSchema: unknown; // JSON Schema generated from the zod schema
};

export type AgentRequest<T> = {
  name: string;
  slug: string;
  version: string;
  prompt: string;
  schema: ZodType<T>;
  /** Minimal context only: never names, DOB or contact details. */
  context: Record<string, unknown>;
  images?: ImagePart[];
  mock: () => T;
  /** Replay the mock even when the real host is configured (synthetic seed studies have no raster image). */
  forceMock?: boolean;
  signal?: AbortSignal;
  runId?: string;
};

export type HostResult = { data: unknown; model: string };

export type HostStatus = { kind: "mock" | "openswarm"; connected: boolean; label: string; detail?: string };

export interface SwarmHost {
  kind: "mock" | "openswarm";
  invoke(def: AgentDefinition, req: { context: Record<string, unknown>; images?: ImagePart[]; signal?: AbortSignal; runId?: string; mock: () => unknown }): Promise<HostResult>;
  status(): Promise<HostStatus>;
}

const mockHost = new MockSwarmHost();
let realHost: OpenSwarmHost | null = null;

/** SWARM_HOST=openswarm plus OPENSWARM_HOST_URL selects the real host; anything else uses the mock. */
export function swarmHost(): SwarmHost {
  if (process.env.SWARM_HOST !== "openswarm" || !process.env.OPENSWARM_HOST_URL) return mockHost;
  if (!realHost) realHost = new OpenSwarmHost(validateHostUrl(process.env.OPENSWARM_HOST_URL), process.env.OPENSWARM_TOKEN ?? "");
  return realHost;
}

/** Fields that must never reach the host. */
const FORBIDDEN_KEYS = ["name", "patientName", "dob", "dateOfBirth", "email", "phone", "address", "patientId"];

export function assertMinimalContext(context: Record<string, unknown>) {
  const walk = (v: unknown, path: string) => {
    if (!v || typeof v !== "object") return;
    for (const [k, val] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.includes(k)) throw new Error(`Refusing to send "${path}${k}" to the swarm host (data minimization).`);
      walk(val, `${path}${k}.`);
    }
  };
  walk(context, "");
}

export function definitionFor<T>(req: Pick<AgentRequest<T>, "name" | "slug" | "version" | "prompt" | "schema">): AgentDefinition {
  return { name: req.name, slug: req.slug, version: req.version, prompt: req.prompt, outputSchema: z.toJSONSchema(req.schema) };
}

export async function invokeAgent<T>(req: AgentRequest<T>): Promise<{ data: T; model: string; host: "mock" | "openswarm" }> {
  assertMinimalContext(req.context);
  const host = req.forceMock ? mockHost : swarmHost();
  const def = definitionFor(req);
  const payload = { context: req.context, images: (req.images ?? []).map((i) => ({ mimeType: i.mimeType, bytes: i.data.length })) };
  // Every request to the host is logged (hashes only, no content).
  await audit({
    actor: req.name,
    action: "host.request",
    entity: "SwarmRun",
    entityId: req.runId,
    inputs: { def: { slug: def.slug, version: def.version }, payload },
    details: { host: host.kind, promptVersion: req.version, images: payload.images.length, contextHash: hash(req.context) },
  });
  const res = await host.invoke(def, { context: req.context, images: req.images, signal: req.signal, runId: req.runId, mock: req.mock });
  const parsed = req.schema.safeParse(res.data);
  if (!parsed.success) {
    await audit({ actor: req.name, action: "host.invalid_output", entity: "SwarmRun", entityId: req.runId, outputs: res.data, model: res.model, details: { issues: parsed.error.issues.length } });
    throw new Error(`${req.name} returned output that doesn't match its format: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  }
  return { data: parsed.data, model: res.model, host: host.kind };
}
