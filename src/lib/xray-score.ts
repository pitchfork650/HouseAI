import type { OverlayShape } from "./pano";
import { compareByBox, compareToGroundTruth, labelFamily, LABEL_TEXT, type Comparison, type GroundTruth } from "./ground-truth";
import { pixelBoxToOverlay } from "./xray-frame";

type StudyLike = { labels: unknown; width: number | null; height: number | null };
type FindingLike = { teeth: number[]; condition: string; overlay: OverlayShape[] };

const asBox = (o: OverlayShape) => (o.kind === "box" ? { x: o.x, y: o.y, w: o.w, h: o.h } : { x: o.x - o.r, y: o.y - o.r, w: 2 * o.r, h: 2 * o.r });

/** Expert labels drawn in the viewer frame. Box-only labels are numbered L1, L2… to match the scorecard. */
export function truthOverlays(study: StudyLike): OverlayShape[] {
  const labels = (study.labels as GroundTruth[] | null) ?? [];
  if (!study.width || !study.height) return [];
  const size = { width: study.width, height: study.height };
  return labels.map((l, i) =>
    pixelBoxToOverlay(l.box, l.tooth != null ? `#${l.tooth} ${LABEL_TEXT[l.label]}` : `L${i + 1}${l.votes ? ` · ${l.votes} dentists` : ""}`, size),
  );
}

/** Score a run's findings against a study's expert labels, by tooth when labelled per tooth, else by box overlap. */
export function scoreFindings(findings: FindingLike[], study: StudyLike): Comparison | null {
  const labels = (study.labels as GroundTruth[] | null) ?? null;
  if (!labels) return null;
  if (labels.every((l) => l.tooth != null)) return compareToGroundTruth(findings, labels);
  const boxes = truthOverlays(study).map(asBox);
  return compareByBox(
    findings.map((f) => ({ condition: f.condition, boxes: f.overlay.map(asBox) })),
    labels.map((l, i) => ({ family: labelFamily(l.label), box: boxes[i] })),
  );
}
