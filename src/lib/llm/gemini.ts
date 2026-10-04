import { GoogleGenAI } from "@google/genai";
import type { ImagePart } from "./index";

let client: GoogleGenAI | null = null;

function ai(): GoogleGenAI {
  if (client) return client;
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === "true") {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION,
    });
  } else {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const model = () => process.env.GEMINI_MODEL || "gemini-3.5-flash";

function parts(prompt: string, images?: ImagePart[]) {
  return [
    ...(images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data.toString("base64") } })),
    { text: prompt },
  ];
}

/** Rate limits (429) and overload (503) are common on free-tier keys: back off and retry. */
async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (i >= attempts - 1 || signal?.aborted || (status !== 429 && status !== 503 && status !== 500)) throw e;
      // A daily quota says "retry in 10h…": retrying now only burns time.
      const wait = /retryDelay"?:\s*"(\d+)s"/.exec(String((e as Error).message))?.[1];
      if (status === 429 && wait && Number(wait) > 60) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i + Math.random() * 500));
    }
  }
}

export async function geminiJSON(o: { system: string; prompt: string; images?: ImagePart[]; signal?: AbortSignal; temperature?: number }): Promise<unknown> {
  const res = await withRetry(
    () =>
      ai().models.generateContent({
        model: model(),
        contents: [{ role: "user", parts: parts(o.prompt, o.images) }],
        config: { systemInstruction: o.system, responseMimeType: "application/json", temperature: o.temperature ?? 0.2, abortSignal: o.signal },
      }),
    o.signal,
  );
  const text = res.text ?? "";
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}
