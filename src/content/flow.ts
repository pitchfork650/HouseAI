import type { IconName } from "@/components/icons";
import { DEFAULT_ROUTES } from "@/lib/config";

/** Platform overview steps shown on the Flow page (product copy, not patient data). */
export type FlowStep = {
  num: string;
  title: string;
  icon: IconName;
  tag: string;
  body: string;
  out: string;
  swarm?: boolean;
  arrow: boolean;
  href: string;
};

export const FLOW_ROWS: { eyebrow: string; steps: FlowStep[]; loopsBack?: { title: string; body: string; href: string } }[] = [
  {
    eyebrow: "BEFORE THE VISIT",
    steps: [
      { num: "01", title: "Intake", icon: "upload", tag: "Form · CSV · drop zone", arrow: true, href: "/intake", body: "Add one patient or a whole day at once. Drop in X-rays, intraoral photos, insurance cards and old records.", out: "Out: patient + files" },
      { num: "02", title: "Read documents", icon: "scan", tag: "OCR + Gemini", arrow: true, href: "/intake#card-ocr", body: "OCR fills in name, date of birth, member ID, group number and carrier. Staff only confirm fields marked low-confidence.", out: "Out: structured record" },
      { num: "03 · TRACK 1", title: "Swarm diagnostics", icon: "swarm", tag: "OpenSwarm", swarm: true, arrow: true, href: DEFAULT_ROUTES.diagnostics, body: "Specialist agents each read the X-ray, a skeptic challenges their findings, and a consensus agent explains each finding by tooth number.", out: "Out: findings + confidence" },
      { num: "04", title: "Prioritize", icon: "pulse", tag: "Rules", arrow: false, href: `${DEFAULT_ROUTES.diagnostics}#findings`, body: "Each finding maps to a procedure code, duration and priority. P1 urgent · P2 long / high-value · P3 restorative · P4 routine.", out: "Out: treatment plan" },
    ],
  },
  {
    eyebrow: "BOOK · VERIFY · BRING BACK",
    steps: [
      { num: "05", title: "Calendar builder", icon: "calendar", tag: "Rules", arrow: true, href: "/schedule", body: "Fills the whole schedule automatically: long cases in the morning, one emergency slot held, checkups fill the gaps.", out: "Out: booked day / week" },
      { num: "06", title: "Insurance swarm", icon: "shieldCheck", tag: "OpenSwarm", swarm: true, arrow: true, href: DEFAULT_ROUTES.insurance, body: "One agent per insurer checks eligibility, chases copay amounts, coordinates dual coverage and files pre-approvals with the X-rays attached.", out: "Out: patient cost estimate" },
      { num: "07", title: "Follow-up", icon: "mail", tag: "Gemini + template", arrow: false, href: DEFAULT_ROUTES.followUp, body: "A personalized email with a short video for that procedure, sent 24 h after the visit, with a link to book the next check.", out: "Out: rebooking, retention" },
    ],
    loopsBack: { title: "Loops back", body: "At the next recall X-ray, the swarm compares against earlier X-rays and flags what changed.", href: "/recall/P-1042" },
  },
];

export const COMPLIANCE_ITEMS = [
  "One patient record",
  "Audit log of every agent decision",
  "SOC 2 compliant",
  "GDPR: consent, data minimization, EU residency, erasure",
  "Dentist signs off on every finding",
];
