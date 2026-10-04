import type { DemoAgent, DemoFinding } from "@/components/landing/HeroDemo";
import type { OverlayShape } from "@/lib/pano";

/**
 * The landing hero's X-ray, hard-coded so it never depends on the database: a real
 * panoramic with its four developing third molars labelled by hand (boxes in the
 * viewer's 800×400 frame, image 686×447).
 */
export const HERO_XRAY = {
  patientId: "CX-01",
  src: "/demo/panoramic.jpg",
  width: 686,
  height: 447,
  studyLabel: "Panoramic X-ray",
};

export const HERO_LOWER: OverlayShape[] = [
  { kind: "box", x: 161.1, y: 207.6, w: 54.6, h: 62.6, label: "#32", lx: 161.1, ly: 284 },
  { kind: "box", x: 587.9, y: 202.2, w: 54.6, h: 66.2, label: "#17", lx: 587.9, ly: 282 },
];
export const HERO_UPPER: OverlayShape[] = [
  { kind: "box", x: 205.8, y: 127.1, w: 51.9, h: 60.9, label: "#1", lx: 205.8, ly: 122.1 },
  { kind: "box", x: 543.2, y: 123.5, w: 50.1, h: 66.2, label: "#16", lx: 543.2, ly: 118.5 },
];

export const HERO_FINDINGS: DemoFinding[] = [
  { teeth: [17, 32], priority: "P2", title: "Impacted lower third molars", suggested: "D7240 · 60 min", agreement: 3, overlay: HERO_LOWER },
  { teeth: [1, 16], priority: "P2", title: "Partially bony upper third molars", suggested: "D7230 · 45 min", agreement: 3, overlay: HERO_UPPER },
];

export const HERO_AGENTS: DemoAgent[] = [
  { name: "Caries Scout", badge: "Nothing found", status: "done" },
  { name: "Root-Tip Agent", badge: "Nothing found", status: "done" },
  { name: "Third-Molar Agent", badge: "4 found", status: "done" },
  { name: "Restoration Auditor", badge: "Nothing found", status: "done" },
  { name: "Verifier", badge: "2 of 2 confirmed", status: "done" },
  { name: "Skeptic", badge: "No challenges", status: "done" },
  { name: "Shade Agent", badge: "Skipped", status: "skip" },
];
