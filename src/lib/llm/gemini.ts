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

const model = () => process.env.GEMINI_MODEL || "gemini-2.5-pro";

function parts(prompt: string, images?: ImagePart[]) {
  return [
    ...(images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data.toString("base64") } })),
    { text: prompt },
  ];
}

export async function geminiJSON(o: { system: string; prompt: string; images?: ImagePart[]; signal?: AbortSignal }): Promise<unknown> {
  const res = await ai().models.generateContent({
    model: model(),
    contents: [{ role: "user", parts: parts(o.prompt, o.images) }],
    config: { systemInstruction: o.system, responseMimeType: "application/json", temperature: 0.2, abortSignal: o.signal },
  });
  const text = res.text ?? "";
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
}

export async function geminiText(o: { system: string; prompt: string; signal?: AbortSignal }): Promise<string> {
  const res = await ai().models.generateContent({
    model: model(),
    contents: [{ role: "user", parts: [{ text: o.prompt }] }],
    config: { systemInstruction: o.system, temperature: 0.4, abortSignal: o.signal },
  });
  return res.text ?? "";
}
