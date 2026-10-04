import { panoGeometry, type OverlayShape } from "@/lib/pano";

/** Overlay colours by priority: P1 orange root-tip circle, P2 amber surgery box, P3 blue restorative. */
const OVERLAY_COLORS: Record<string, { stroke: string; label: string; fill?: string }> = {
  P1: { stroke: "#FB923C", label: "#FDBA74", fill: "#F97316" },
  P2: { stroke: "#FBBF24", label: "#FCD34D" },
  P3: { stroke: "#60A5FA", label: "#93C5FD" },
  P4: { stroke: "#C9D6E8", label: "#C9D6E8" },
};

/** The stylized synthetic panoramic (seed patients). */
export function SyntheticPano() {
  const g = panoGeometry();
  return (
    <>
      <defs>
        <radialGradient id="pano-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#26303C" />
          <stop offset="100%" stopColor="#05090F" />
        </radialGradient>
      </defs>
      <rect width="800" height="400" fill="url(#pano-glow)" />
      <ellipse cx={g.sinusL.cx} cy={g.sinusL.cy} rx="58" ry="30" fill="#080D14" opacity="0.8" />
      <ellipse cx={g.sinusR.cx} cy={g.sinusR.cy} rx="58" ry="30" fill="#080D14" opacity="0.8" />
      <path d="M60 175 Q400 150 740 175 L700 40 Q400 10 100 40 Z" fill="#3A4656" opacity="0.35" />
      <path d="M40 110 L62 300 Q120 372 400 388 Q680 372 738 300 L760 110 L720 110 L705 215 Q400 250 95 215 L80 110 Z" fill="#3A4656" opacity="0.45" />
      <path d="M95 215 Q400 250 705 215 L700 300 Q400 340 100 300 Z" fill="#3A4656" opacity="0.35" />
      <path d={g.faint} fill="#B8C3CF" opacity="0.18" />
      <path d={g.teeth} fill="#AEB9C6" opacity="0.62" />
      <path d={g.enamel} fill="#E6ECF2" opacity="0.55" />
      <path d={g.pulp} fill="#141B25" opacity="0.75" />
      <path d={g.canals} stroke="#141B25" strokeWidth="1.6" fill="none" opacity="0.75" />
      <path d={g.resto} fill="#F7FAFC" />
      <path d={g.caries} fill="#05090F" opacity="0.85" />
      <path d={g.lesion} fill="#05090F" opacity="0.6" />
      <path d={g.nerveL} stroke="#7DD3E0" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <path d={g.nerveR} stroke="#7DD3E0" strokeWidth="1.5" strokeDasharray="5 4" fill="none" />
      <text x={g.canalLabel.x} y={g.canalLabel.y} fill="#7DD3E0" fontFamily="var(--font-plex-mono), monospace" fontSize="10">
        nerve canal (traced)
      </text>
    </>
  );
}

export function Overlay({ findings }: { findings: { priority: string; overlay: OverlayShape[] }[] }) {
  return (
    <g>
      {findings.flatMap((f, i) =>
        f.overlay.map((s, j) => {
          const c = OVERLAY_COLORS[f.priority] ?? OVERLAY_COLORS.P4;
          return (
            <g key={`${i}-${j}`}>
              {s.kind === "box" ? (
                <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="6" fill="none" stroke={c.stroke} strokeWidth="2" />
              ) : (
                <circle cx={s.x} cy={s.y} r={s.r} fill={c.fill && s.r > 10 ? c.fill : "none"} fillOpacity={c.fill && s.r > 10 ? 0.15 : undefined} stroke={c.stroke} strokeWidth="2" />
              )}
              <text x={s.lx} y={s.ly} fill={c.label} fontFamily="var(--font-plex-mono), monospace" fontSize="11">
                {s.label}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}
