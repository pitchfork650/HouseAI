import fs from "node:fs";
import path from "node:path";

/**
 * Agent prompts live in versioned files: agents/<agent>.v<N>.md. The highest
 * version wins unless one is pinned. The version is recorded on every AgentRun.
 */
export type Prompt = { agent: string; version: string; text: string };

const DIR = path.join(process.cwd(), "agents");
const cache = new Map<string, Prompt>();

export function loadPrompt(agent: string, pinned?: string): Prompt {
  const key = `${agent}@${pinned ?? "latest"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith(`${agent}.v`) && f.endsWith(".md"));
  if (!files.length) throw new Error(`No prompt file for agent "${agent}" in agents/`);
  const versions = files.map((f) => ({ f, v: Number(f.slice(agent.length + 2, -3)) })).sort((a, b) => b.v - a.v);
  const chosen = pinned ? versions.find((x) => `v${x.v}` === pinned) : versions[0];
  if (!chosen) throw new Error(`Prompt ${agent} ${pinned} not found`);
  const p = { agent, version: `v${chosen.v}`, text: fs.readFileSync(path.join(DIR, chosen.f), "utf8") };
  cache.set(key, p);
  return p;
}
