/**
 * Stylized synthetic panoramic X-ray (800×400 image coordinates), ported from the
 * Diagnose mockup. Per-tooth anatomy in mm → SVG paths. Universal numbering:
 * upper #1–#16 and lower #32–#17, left to right.
 *
 * Used to render the seed patient's panoramic and to place overlay geometry for the
 * seeded findings. Real uploads render the uploaded image instead.
 */

export type OverlayShape =
  | { kind: "box"; x: number; y: number; w: number; h: number; label: string; lx: number; ly: number }
  | { kind: "circle"; x: number; y: number; r: number; label: string; lx: number; ly: number };

export type PanoGeometry = {
  teeth: string;
  enamel: string;
  pulp: string;
  canals: string;
  faint: string;
  resto: string;
  caries: string;
  lesion: string;
  nerveL: string;
  nerveR: string;
  sinusL: { cx: number; cy: number };
  sinusR: { cx: number; cy: number };
  canalLabel: { x: number; y: number };
  boxes: Record<number, { x: number; y: number; w: number; h: number; dot?: { x: number; y: number } }>;
  apex: Record<string, { x: number; y: number }>;
};

type Spec = [w: number, ch: number, rl: number, roots: number, fur: number, cusp: "flat" | "point" | "pm" | "molar"];
type Cmd = (string | number)[];

const S = 4.7, CX = 400, K = 0.00025, YU = 196, YL = 206;
const U: Spec[] = [[8.5, 10.5, 13, 1, 0, "flat"], [6.5, 9, 13, 1, 0, "flat"], [7.5, 10, 17, 1, 0, "point"], [7, 8.5, 14, 2, 0.6, "pm"], [6.5, 7.5, 14, 1, 0, "pm"], [10, 7.5, 12, 2, 0.3, "molar"], [9, 7, 11, 2, 0.35, "molar"], [8.5, 6.5, 11, 2, 0.75, "molar"]];
const L: Spec[] = [[5, 9, 12.5, 1, 0, "flat"], [5.5, 9.5, 14, 1, 0, "flat"], [7, 11, 16, 1, 0, "point"], [7, 8.5, 14, 1, 0, "pm"], [7, 8, 14.5, 1, 0, "pm"], [11, 7.5, 14, 2, 0.25, "molar"], [10.5, 7, 13, 2, 0.3, "molar"], [10, 7, 11, 2, 0.7, "molar"]];
const r = (v: number) => Math.round(v * 10) / 10;
const off = (x: number) => K * (x - CX) * (x - CX);
const typeIdx = (n: number) => (n <= 8 ? 8 - n : n <= 16 ? n - 9 : n <= 24 ? 24 - n : n - 25);
const EXTRA: Record<number, { tilt: number; deep: number; pivot: number }> = { 32: { tilt: 45, deep: 7, pivot: 9 }, 17: { tilt: -30, deep: 3.5, pivot: 9 } };

type Placed = { n: number; cx: number; spec: Spec; upper: boolean };

function layout(nums: number[], upper: boolean): Placed[] {
  const specs = nums.map((n) => (upper ? U : L)[typeIdx(n)]);
  const gap = 2;
  const total = specs.reduce((a, s) => a + s[0] * S, 0) + gap * (nums.length - 1);
  let x = CX - total / 2;
  return nums.map((n, i) => {
    const w = specs[i][0] * S;
    const cx = x + w / 2;
    x += w + gap;
    return { n, cx, spec: specs[i], upper };
  });
}

function shapes(spec: Spec, dist: number) {
  const [w, ch, rl, roots, fur, cusp] = spec;
  const ax = dist * w * 0.06;
  const A = roots === 2 ? [-w * 0.44, ch * 0.1] : [-w * 0.4, ch * 0.06];
  const B = [-A[0], A[1]];
  const cw = w * (roots === 2 ? 0.82 : 0.68);
  const side = roots === 2 ? 0.53 : 0.52;
  let occ: Cmd[];
  if (cusp === "point") occ = [["Q", w * 0.18, -ch * 0.02, 0, -ch * 0.1], ["Q", -w * 0.18, -ch * 0.02, A[0], A[1]]];
  else if (cusp === "pm") occ = [["Q", w * 0.25, -ch * 0.06, 0, ch * 0.03], ["Q", -w * 0.25, -ch * 0.06, A[0], A[1]]];
  else if (cusp === "molar") occ = [["Q", w * 0.32, -ch * 0.08, w * 0.08, ch * 0.05], ["Q", 0, ch * 0.09, -w * 0.08, ch * 0.05], ["Q", -w * 0.32, -ch * 0.08, A[0], A[1]]];
  else occ = [["Q", 0, -ch * 0.03, A[0], A[1]]];
  const crownL: Cmd = ["Q", -w * side, ch * 0.47, -cw / 2, ch];
  const crownR: Cmd = ["Q", w * side, ch * 0.47, B[0], B[1]];
  const lenL = roots === 2 && dist === -1 ? rl * 0.92 : rl;
  const lenR = roots === 2 && dist === 1 ? rl * 0.92 : rl;
  let root: Cmd[];
  if (roots === 1) {
    root = [
      ["Q", -cw * 0.5, ch + rl * 0.55, -cw * 0.12 + ax, ch + rl * 0.97],
      ["Q", ax, ch + rl * 1.03, cw * 0.12 + ax, ch + rl * 0.97],
      ["Q", cw * 0.5, ch + rl * 0.55, cw / 2, ch],
    ];
  } else {
    root = [
      ["Q", -cw * 0.55, ch + lenL * 0.6, -cw * 0.36 + ax, ch + lenL * 0.97],
      ["Q", -cw * 0.27 + ax, ch + lenL * 1.03, -cw * 0.16 + ax, ch + lenL * 0.95],
      ["Q", -cw * 0.08, ch + rl * fur * 0.9 + (lenL - rl * fur) * 0.3, 0, ch + rl * fur],
      ["Q", cw * 0.08, ch + rl * fur * 0.9 + (lenR - rl * fur) * 0.3, cw * 0.16 + ax, ch + lenR * 0.95],
      ["Q", cw * 0.27 + ax, ch + lenR * 1.03, cw * 0.36 + ax, ch + lenR * 0.97],
      ["Q", cw * 0.55, ch + lenR * 0.6, cw / 2, ch],
    ];
  }
  const outline: Cmd[] = [["M", A[0], A[1]], crownL, ...root, crownR, ...occ, ["Z"]];
  const crown: Cmd[] = [["M", A[0], A[1]], crownL, ["L", cw / 2, ch], crownR, ...occ, ["Z"]];
  let pulp: Cmd[];
  let canals: Cmd[][] = [];
  if (roots === 1) {
    pulp = [["M", -w * 0.12, ch * 0.45], ["Q", -w * 0.14, ch * 0.9, -w * 0.05, ch + rl * 0.2], ["L", ax - 0.3, ch + rl * 0.9], ["L", ax + 0.3, ch + rl * 0.9], ["L", w * 0.05, ch + rl * 0.2], ["Q", w * 0.14, ch * 0.9, w * 0.12, ch * 0.45], ["Q", 0, ch * 0.32, -w * 0.12, ch * 0.45], ["Z"]];
  } else {
    pulp = [["M", -w * 0.22, ch * 0.55], ["Q", 0, ch * 0.4, w * 0.22, ch * 0.55], ["L", w * 0.18, ch * 1.08], ["L", -w * 0.18, ch * 1.08], ["Z"]];
    canals = [
      [["M", -w * 0.14, ch * 1.05], ["Q", -cw * 0.3, ch + lenL * 0.5, -cw * 0.26 + ax, ch + lenL * 0.9]],
      [["M", w * 0.14, ch * 1.05], ["Q", cw * 0.3, ch + lenR * 0.5, cw * 0.26 + ax, ch + lenR * 0.9]],
    ];
  }
  return { outline, crown, pulp, canals, w, ch, rl, cw, ax, lenL, lenR, roots };
}

function placer(t: Placed) {
  const ex = EXTRA[t.n] || { tilt: 0, deep: 0, pivot: 0 };
  const y0 = (t.upper ? YU : YL) - off(t.cx);
  const ang = Math.atan(-2 * K * (t.cx - CX)) * 0.6 + (ex.tilt * Math.PI) / 180;
  const sgn = t.upper ? -1 : 1;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return (x: number, d: number): [number, number] => {
    const lx = x * S, ly = sgn * (d - ex.pivot) * S, base = sgn * (ex.pivot + ex.deep) * S;
    return [t.cx + lx * cos - ly * sin, y0 + base + lx * sin + ly * cos];
  };
}

function toPath(cmds: Cmd[], P: (x: number, d: number) => [number, number]): string {
  let s = "";
  for (const c of cmds) {
    if (c[0] === "Z") { s += "Z"; continue; }
    const pts: string[] = [];
    for (let i = 1; i < c.length; i += 2) {
      const p = P(c[i] as number, c[i + 1] as number);
      pts.push(r(p[0]) + " " + r(p[1]));
    }
    s += c[0] + pts.join(" ");
  }
  return s;
}

let cached: PanoGeometry | null = null;

export function panoGeometry(): PanoGeometry {
  if (cached) return cached;
  const upperNums = Array.from({ length: 16 }, (_, i) => i + 1);
  const lowerNums = Array.from({ length: 16 }, (_, i) => 32 - i);
  const out = { teeth: "", enamel: "", pulp: "", canals: "", faint: "", resto: "", caries: "", lesion: "", boxes: {} as PanoGeometry["boxes"], apex: {} as PanoGeometry["apex"] };
  const all = layout(upperNums, true).concat(layout(lowerNums, false));
  for (const t of all) {
    const dist = t.cx < CX ? -1 : 1;
    const mes = -dist;
    const g = shapes(t.spec, dist);
    const P = placer(t);
    out.teeth += toPath(g.outline, P);
    out.enamel += toPath(g.crown, P);
    out.pulp += toPath(g.pulp, P);
    for (const c of g.canals) out.canals += toPath(c, P);
    if (t.upper && g.roots === 2 && t.spec[5] === "molar") {
      out.faint += toPath([["M", -g.cw * 0.18, g.ch], ["Q", g.ax * 0.5, g.ch + g.rl * 0.6, g.ax, g.ch + g.rl * 1.04], ["Q", g.ax * 0.5 + g.cw * 0.1, g.ch + g.rl * 0.6, g.cw * 0.18, g.ch], ["Z"]], P);
    }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const c of g.outline) {
      if (c[0] === "Z") continue;
      const p = P(c[c.length - 2] as number, c[c.length - 1] as number);
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    out.boxes[t.n] = { x: r(minX - 6), y: r(minY - 6), w: r(maxX - minX + 12), h: r(maxY - minY + 12) };
    if (t.n === 14) {
      out.resto += toPath(g.crown, P);
      out.caries += toPath([["M", dist * g.cw * 0.5, g.ch * 0.82], ["L", dist * (g.cw * 0.5 + 0.7), g.ch * 0.82], ["L", dist * g.cw * 0.5, g.ch * 1.08], ["Z"]], P);
    }
    if (t.n === 30) {
      out.resto += toPath([["M", -g.w * 0.3, g.ch * 0.05], ["L", g.w * 0.3, g.ch * 0.05], ["L", g.w * 0.2, g.ch * 0.6], ["L", -g.w * 0.2, g.ch * 0.6], ["Z"]], P);
      const mApex = mes === -1 ? [-g.cw * 0.26 + g.ax, g.ch + g.lenL] : [g.cw * 0.26 + g.ax, g.ch + g.lenR];
      const c = P(mApex[0], mApex[1] + 0.8);
      out.apex[30] = { x: r(c[0]), y: r(c[1]) };
      out.lesion += "M" + r(c[0] - 15) + " " + r(c[1]) + "a15 13 0 1 0 30 0a15 13 0 1 0 -30 0Z";
    }
    if (t.n === 3 || t.n === 19) {
      const c = P(mes * g.w * 0.46, g.ch * 0.38);
      out.caries += "M" + r(c[0] - 5) + " " + r(c[1]) + "a5 6 0 1 0 10 0a5 6 0 1 0 -10 0Z";
      out.boxes[t.n].dot = { x: r(c[0]), y: r(c[1]) };
    }
    if ([17, 19, 20, 29, 30, 32].includes(t.n)) {
      const a = P(0, g.ch + g.rl);
      out.apex["r" + t.n] = { x: r(a[0]), y: r(a[1]) };
    }
  }
  const canal = (m3: number, m1: number, pm2: number, edgeX: number) => {
    const a3 = out.apex["r" + m3], a1 = out.apex["r" + m1], ap = out.apex["r" + pm2];
    return "M" + edgeX + " " + r(a3.y - 40) + "C" + r(a3.x) + " " + r(a3.y + 10) + " " + r(a1.x) + " " + r(a1.y + 26) + " " + r(ap.x) + " " + r(ap.y + 10);
  };
  const u = layout(upperNums, true);
  const canalEnd = out.apex.r20;
  cached = {
    ...out,
    nerveL: canal(32, 30, 29, 70),
    nerveR: canal(17, 19, 20, 730),
    sinusL: { cx: r(u[2].cx + 6), cy: r(YU - off(u[2].cx) - 112) },
    sinusR: { cx: r(u[13].cx - 6), cy: r(YU - off(u[13].cx) - 112) },
    canalLabel: { x: Math.round(canalEnd.x + 10), y: Math.round(canalEnd.y + 34) },
  };
  return cached;
}

/** Overlay geometry for a tooth, matching the mockup's label placement. */
export function overlayFor(tooth: number, style: "box-below" | "box-above" | "apex" | "dot-below" | "dot-above", label: string): OverlayShape {
  const g = panoGeometry();
  const b = g.boxes[tooth];
  switch (style) {
    case "box-below":
      return { kind: "box", x: b.x, y: b.y, w: b.w, h: b.h, label, lx: b.x, ly: Math.round(b.y + b.h + 14) };
    case "box-above":
      return { kind: "box", x: b.x, y: b.y, w: b.w, h: b.h, label, lx: b.x, ly: Math.round(b.y - 6) };
    case "apex": {
      const a = g.apex[tooth];
      return { kind: "circle", x: a.x, y: a.y, r: 18, label, lx: Math.round(a.x + 22), ly: Math.round(a.y + 5) };
    }
    case "dot-below": {
      const d = b.dot!;
      return { kind: "circle", x: d.x, y: d.y, r: 8, label, lx: Math.round(d.x - 8), ly: Math.round(d.y + 22) };
    }
    case "dot-above": {
      const d = b.dot!;
      return { kind: "circle", x: d.x, y: d.y, r: 8, label, lx: Math.round(d.x + 10), ly: Math.round(d.y - 14) };
    }
  }
}

/** Standalone SVG markup of the synthetic panoramic (sent to the host for seed studies). */
export function panoSvg(): string {
  const g = panoGeometry();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
<defs><radialGradient id="g" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#26303C"/><stop offset="100%" stop-color="#05090F"/></radialGradient></defs>
<rect width="800" height="400" fill="url(#g)"/>
<ellipse cx="${g.sinusL.cx}" cy="${g.sinusL.cy}" rx="58" ry="30" fill="#080D14" opacity="0.8"/>
<ellipse cx="${g.sinusR.cx}" cy="${g.sinusR.cy}" rx="58" ry="30" fill="#080D14" opacity="0.8"/>
<path d="M60 175 Q400 150 740 175 L700 40 Q400 10 100 40 Z" fill="#3A4656" opacity="0.35"/>
<path d="M40 110 L62 300 Q120 372 400 388 Q680 372 738 300 L760 110 L720 110 L705 215 Q400 250 95 215 L80 110 Z" fill="#3A4656" opacity="0.45"/>
<path d="M95 215 Q400 250 705 215 L700 300 Q400 340 100 300 Z" fill="#3A4656" opacity="0.35"/>
<path d="${g.faint}" fill="#B8C3CF" opacity="0.18"/>
<path d="${g.teeth}" fill="#AEB9C6" opacity="0.62"/>
<path d="${g.enamel}" fill="#E6ECF2" opacity="0.55"/>
<path d="${g.pulp}" fill="#141B25" opacity="0.75"/>
<path d="${g.canals}" stroke="#141B25" stroke-width="1.6" fill="none" opacity="0.75"/>
<path d="${g.resto}" fill="#F7FAFC"/>
<path d="${g.caries}" fill="#05090F" opacity="0.85"/>
<path d="${g.lesion}" fill="#05090F" opacity="0.6"/>
</svg>`;
}
