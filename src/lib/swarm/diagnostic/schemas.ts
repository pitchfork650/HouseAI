import { z } from "zod";

export const CONDITIONS = [
  "periapical_lesion",
  "impacted_complete_bony",
  "impacted_partial_bony",
  "impacted_soft_tissue",
  "open_margin",
  "caries_dentin_interproximal",
  "caries_enamel",
  "shade_mismatch",
] as const;

/** Overlay geometry in the 800×400 image frame. */
export const OverlaySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("box"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string(), lx: z.number(), ly: z.number() }),
  z.object({ kind: z.literal("circle"), x: z.number(), y: z.number(), r: z.number(), label: z.string(), lx: z.number(), ly: z.number() }),
]);

/** What a model reading a real image returns: box_2d [ymin, xmin, ymax, xmax] normalized 0–1000 to that image. */
export const Box2dOverlaySchema = z.object({
  kind: z.literal("box2d"),
  box_2d: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  label: z.string(),
});

export const SpecialistFindingSchema = z.object({
  teeth: z.array(z.number().int().min(1).max(32)).min(1),
  condition: z.enum(CONDITIONS),
  detail: z.string(),
  confidence: z.number().min(0).max(1),
  nearNerveCanal: z.boolean().optional(),
  overlay: z.array(OverlaySchema).default([]),
});

export const SpecialistOutputSchema = z.object({
  findings: z.array(SpecialistFindingSchema),
  summary: z.string(),
});

/** Specialist output as the host returns it: frame overlays (mocks) or box_2d (real images), normalized after. */
export const SpecialistRawOutputSchema = z.object({
  findings: z.array(SpecialistFindingSchema.extend({ overlay: z.array(z.union([OverlaySchema, Box2dOverlaySchema])).default([]) })),
  summary: z.string(),
});

export const VerifierOutputSchema = z.object({
  results: z.array(z.object({ id: z.string(), confirmed: z.boolean(), note: z.string().default("") })),
  summary: z.string(),
});

export const SkepticOutputSchema = z.object({
  challenges: z.array(z.object({ id: z.string(), reason: z.string() })),
  summary: z.string(),
});

export const ConsensusOutputSchema = z.object({
  rows: z.array(z.object({ key: z.string(), text: z.string() })),
});

export type SpecialistFinding = z.infer<typeof SpecialistFindingSchema>;
export type SpecialistOutput = z.infer<typeof SpecialistOutputSchema>;
export type SpecialistRawOutput = z.infer<typeof SpecialistRawOutputSchema>;
export type VerifierOutput = z.infer<typeof VerifierOutputSchema>;
export type SkepticOutput = z.infer<typeof SkepticOutputSchema>;
export type ConsensusOutput = z.infer<typeof ConsensusOutputSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;

export type Candidate = SpecialistFinding & { id: string; reporter: string };
