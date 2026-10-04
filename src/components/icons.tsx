export const ICON = {
  tooth: "M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7.5.4 2.6 1 6 2.5 6s1.7-3.5 2.5-6c.3-1 1.7-1 2 0 .8 2.5 1 6 2.5 6s2.1-3.4 2.5-6c.5-3 2-4.5 2-7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  shieldCheck: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  swarm: "M12 5a2 2 0 1 0 0 .01M5 17a2 2 0 1 0 0 .01M19 17a2 2 0 1 0 0 .01M12 7v4M12 11l-5.5 5M12 11l5.5 5M7 17h10",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5",
  scanNav: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  pulse: "M3 12h4l2-6 4 12 2-6h6",
  warning: "M12 4l9 16H3zM12 10v4M12 17v.01",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  check: "M5 12l5 5L20 7",
  flow: "M4 6h16M4 12h10M4 18h6",
  dollar: "M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7",
  document: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  sparkle: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0",
  loop: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  zoom: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M11 8v6M8 11h6",
  contrast: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18",
  ruler: "M4 16L16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2",
  play: "M8 5v14l11-7z",
} as const;

export type IconName = keyof typeof ICON;

export function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth = 1.8,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={ICON[name]} />
    </svg>
  );
}

export function PlayIcon({ size = 12, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d={ICON.play} />
    </svg>
  );
}

/** Teal rounded tile with the tooth outline. */
export function LogoTile({ size, radius, glyph, strokeWidth = 1.7 }: { size: number; radius: number; glyph: number; strokeWidth?: number }) {
  return (
    <div
      style={{ width: size, height: size, borderRadius: radius, background: "#0B7285", flex: "none" }}
      className="flex items-center justify-center"
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={strokeWidth} strokeLinejoin="round" aria-hidden="true">
        <path d={ICON.tooth} />
      </svg>
    </div>
  );
}
