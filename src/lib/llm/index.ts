import type { ZodType } from "zod";
import { geminiJSON } from "./gemini";

/**
 * Every model call in the app goes through this module. With no GEMINI_API_KEY
 * (or for synthetic studies), calls return the canned `mock` response instead.
 */
export type ImagePart = { mimeType: string; data: Buffer };

export type JSONCall<T> = {
  agent: string;
  promptVersion: string;
  system: string;
  prompt: string;
  images?: ImagePart[];
  schema: ZodType<T>;
  mock: () => T;
  /** Force the canned response (synthetic studies, tests). */
  forceMock?: boolean;
  signal?: AbortSignal;
};

export type ModelResult<T> = { data: T; model: string; mocked: boolean };

export const MOCK_MODEL = "mock";

export function llmMode(): "gemini" | "mock" {
  return process.env.GEMINI_API_KEY ? "gemini" : "mock";
}

export function modelName(): string {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

/** Simulated latency in mock mode so the UI's running state is visible. */
async function mockDelay(signal?: AbortSignal) {
  const max = Number(process.env.MOCK_LATENCY_MS ?? (process.env.NODE_ENV === "test" ? 0 : 1200));
  if (!max) return;
  const ms = Math.round(max * (0.4 + Math.random() * 0.6));
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error("aborted"));
    });
  });
}

export async function callJSON<T>(c: JSONCall<T>): Promise<ModelResult<T>> {
  if (c.forceMock || llmMode() === "mock") {
    await mockDelay(c.signal);
    return { data: c.schema.parse(c.mock()), model: MOCK_MODEL, mocked: true };
  }
  assertResidency();
  const raw = await geminiJSON({ system: c.system, prompt: c.prompt, images: c.images, signal: c.signal });
  return { data: c.schema.parse(raw), model: modelName(), mocked: false };
}

/** Data residency: with enforcement on, only Vertex AI in an EU region is allowed. */
export function assertResidency() {
  if (process.env.DATA_RESIDENCY !== "eu" || process.env.DATA_RESIDENCY_ENFORCE !== "true") return;
  const vertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true";
  const loc = process.env.GOOGLE_CLOUD_LOCATION ?? "";
  if (!vertex || !loc.startsWith("europe-")) {
    throw new Error("Data residency is set to EU: model calls must go through Vertex AI in an europe-* location.");
  }
}

/**
 * Never send real patient data to a model outside production. Seed and test
 * patients are flagged synthetic; anything else is refused in dev and tests.
 */
export function assertMayUseModel(patient: { synthetic: boolean }) {
  if (process.env.NODE_ENV !== "production" && !patient.synthetic && llmMode() === "gemini") {
    throw new Error("Refusing to send non-synthetic patient data to a model outside production.");
  }
}
