import { assertResidency, modelName } from "../../llm";
import { geminiJSON } from "../../llm/gemini";
import type { AgentDefinition, HostResult, HostStatus, SwarmHost } from "./index";

/**
 * Runs each swarm agent as a Gemini call in this process: the agent's versioned
 * prompt plus its output format as the system instruction, the minimal context
 * as the user turn, and the X-ray images inline. Output is validated by invokeAgent.
 */
export class GeminiSwarmHost implements SwarmHost {
  kind = "gemini" as const;

  async invoke(def: AgentDefinition, req: Parameters<SwarmHost["invoke"]>[1]): Promise<HostResult> {
    assertResidency();
    const images = (req.images ?? []).filter((i) => i.mimeType !== "image/svg+xml");
    const system = `${def.prompt}\n\nYour reply must be a single JSON object that validates against this JSON Schema:\n${JSON.stringify(def.outputSchema)}`;
    const prompt = `Context for this request (JSON):\n${JSON.stringify(req.context)}\n\n${images.length ? `${images.length} image(s) attached, in the order of context.studies.` : "No images attached."}`;
    const data = await geminiJSON({ system, prompt, images, signal: req.signal, temperature: 0 });
    return { data, model: modelName() };
  }

  async status(): Promise<HostStatus> {
    return { kind: "gemini", connected: true, label: `Gemini · ${modelName()}`, detail: "Agents run as Gemini calls from this server" };
  }
}
