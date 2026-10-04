import type { DemoAgent, DemoFinding } from "@/components/landing/HeroDemo";
import type { OverlayShape } from "@/lib/pano";

/**
 * The landing hero's X-ray, hard-coded so it never depends on the database: a real
 * periapical from Wikimedia Commons with the periapical lesion its title names
 * labelled by hand (box in the viewer's 800×400 frame, image 668×1000).
 */
export const HERO_XRAY = {
  patientId: "CX-01",
  src: "/demo/periapical-radiolucency.jpg",
  studyLabel: "Periapical X-ray",
  credit: "Periapical radiolucency.jpg, Shaimaa Abdellatif, Wikimedia Commons, CC BY-SA 4.0",
};

export const HERO_OVERLAY: OverlayShape[] = [{ kind: "box", x: 360.4, y: 44, w: 114, h: 180, label: "#8 #9 periapical lesion", lx: 360.4, ly: 39 }];

export const HERO_FINDINGS: DemoFinding[] = [
  { teeth: [8, 9], priority: "P1", title: "Periapical radiolucency", suggested: "D3310 root canal, anterior · 45 min", agreement: 3, overlay: HERO_OVERLAY },
];

export const HERO_AGENTS: DemoAgent[] = [
  { name: "Caries Scout", badge: "Skipped", status: "skip" },
  { name: "Root-Tip Agent", badge: "Flagged", status: "flag" },
  { name: "Third-Molar Agent", badge: "Skipped", status: "skip" },
  { name: "Restoration Auditor", badge: "Nothing found", status: "done" },
  { name: "Verifier", badge: "1 of 1 confirmed", status: "done" },
  { name: "Skeptic", badge: "No challenges", status: "done" },
  { name: "Shade Agent", badge: "Skipped", status: "skip" },
];
