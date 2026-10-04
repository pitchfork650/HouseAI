import { z } from "zod";
import { callJSON, type ImagePart } from "./llm";
import { loadPrompt } from "./prompts";

/** Insurance-card OCR: one Gemini vision call, per-field confidence. */
export const CARD_FIELDS = ["name", "dob", "memberId", "groupNumber", "carrier"] as const;
export type CardField = (typeof CARD_FIELDS)[number];
export const CARD_LABELS: Record<CardField, string> = { name: "Name", dob: "Date of birth", memberId: "Member ID", groupNumber: "Group number", carrier: "Carrier" };

const Field = z.object({ value: z.string(), confidence: z.number().min(0).max(1) });
export const CardOcrSchema = z.object({ fields: z.object(Object.fromEntries(CARD_FIELDS.map((f) => [f, Field])) as Record<CardField, typeof Field>) });
export type CardOcr = z.infer<typeof CardOcrSchema>;

/** Staff only confirm fields below this confidence. */
export const LOW_CONFIDENCE = 0.8;

export const MOCK_CARD: CardOcr = {
  fields: {
    name: { value: "Marcus T.", confidence: 0.97 },
    dob: { value: "[DATE]", confidence: 0.93 },
    memberId: { value: "[ID]", confidence: 0.74 },
    groupNumber: { value: "[#]", confidence: 0.91 },
    carrier: { value: "Carrier A", confidence: 0.98 },
  },
};

export async function readInsuranceCard(image: ImagePart, forceMock: boolean) {
  const prompt = loadPrompt("card-ocr");
  return callJSON({
    agent: "Card OCR",
    promptVersion: prompt.version,
    system: prompt.text,
    prompt: "Read this insurance card.",
    images: [image],
    schema: CardOcrSchema,
    mock: () => MOCK_CARD,
    forceMock,
  });
}

export function lowConfidenceFields(o: CardOcr): CardField[] {
  return CARD_FIELDS.filter((f) => o.fields[f].confidence < LOW_CONFIDENCE);
}
