import Link from "next/link";
import { PRIO, asPriority } from "@/lib/priority";
import { Icon } from "./icons";

export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-[16px] border border-border bg-card shadow-card ${className}`} style={style}>
      {children}
    </div>
  );
}

const btnBase = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] text-[14px] no-underline";
export const btnPrimary = `${btnBase} border-0 bg-teal font-bold text-white hover:bg-teal-dark hover:text-white`;
export const btnSecondary = `${btnBase} border border-btn-border bg-white font-semibold text-ink hover:bg-subtle hover:text-ink`;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return <button {...props} className={`${variant === "primary" ? btnPrimary : btnSecondary} px-4 ${className}`} />;
}

export function ButtonLink({ href, variant = "secondary", className = "", children }: { href: string; variant?: "primary" | "secondary"; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`${variant === "primary" ? btnPrimary : btnSecondary} px-4 ${className}`}>
      {children}
    </Link>
  );
}

/** Tint priority pill (tables). */
export function PriorityPill({ p, size = "md" }: { p: string; size?: "sm" | "md" }) {
  const c = PRIO[asPriority(p)];
  return (
    <span
      className={`inline-block rounded-full font-bold ${size === "sm" ? "px-2 py-[2px] text-[11px]" : "px-[10px] py-1 text-[12px]"}`}
      style={{ background: c.pillBg, color: c.pillText }}
    >
      {p}
    </span>
  );
}

/** Solid priority pill (schedule). */
export function SolidPill({ p }: { p: string }) {
  const c = PRIO[asPriority(p)];
  return (
    <span className="inline-block flex-none rounded-full px-2 py-[2px] text-[11px] font-bold text-white" style={{ background: c.solid }}>
      {p}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-[8px] bg-chip px-[10px] py-[5px] text-[12px] font-semibold text-ink-2">{children}</span>;
}

export function AllergyChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[6px] rounded-[8px] bg-allergy-bg px-[10px] py-[5px] text-[12px] font-bold text-allergy">
      <Icon name="warning" size={14} strokeWidth={2.2} />
      {children}
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`font-mono text-[12px] tracking-[0.1em] text-muted ${className}`}>{children}</div>;
}

export function Avatar({ initials, size = 48 }: { initials: string; size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-p3-tint font-extrabold text-p3"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function PatientHeader({
  initials,
  name,
  sub,
  chips,
  right,
}: {
  initials: string;
  name: string;
  sub: string;
  chips: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-5 px-5 py-4">
      <Avatar initials={initials} />
      <div className="flex flex-col gap-[2px]">
        <span className="text-[18px] font-bold">{name}</span>
        <span className="font-mono text-[12px] text-muted">{sub}</span>
      </div>
      <div className="flex flex-wrap gap-2">{chips}</div>
      {right ? <div className="ml-auto flex flex-wrap gap-[10px]">{right}</div> : null}
    </Card>
  );
}
