"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, LogoTile, type IconName } from "./icons";
import { PRACTICE } from "@/lib/config";

export type NavItem = { key: string; label: string; href: string; icon: IconName; count?: number; countTone?: "teal" | "orange"; match: string };

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  return (
    <aside
      className="box-border flex flex-col gap-1 bg-navy px-[14px] py-[22px] text-on-navy"
      style={{ flex: "1 1 232px" }}
    >
      <div className="flex items-center gap-3 px-2 pb-[22px]">
        <LogoTile size={38} radius={11} glyph={22} />
        <div className="flex flex-col">
          <span className="text-[17px] font-extrabold text-white">HouseAI</span>
          <span className="text-[12px] text-cyan">Dental clinical suite</span>
        </div>
      </div>
      <div className="px-3 py-[6px] font-mono text-[11px] tracking-[0.1em] text-nav-label">CLINIC</div>
      <nav className="flex flex-col gap-1" aria-label="Main">
        {items.map((it) => {
          const active = it.match === "/" ? pathname === "/" : pathname.startsWith(it.match);
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 text-[14px] no-underline hover:text-white ${
                active ? "bg-navy-2 font-semibold text-white" : "text-on-navy hover:bg-navy-2/60"
              }`}
            >
              <Icon name={it.icon} size={20} color={active ? "#7DD3E0" : "currentColor"} />
              {it.label}
              {it.count ? (
                <span
                  className="ml-auto rounded-full px-2 py-[2px] text-[11px] text-white"
                  style={{ background: it.countTone === "orange" ? "#C2410C" : "#0B7285" }}
                >
                  {it.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-[6px] rounded-[12px] bg-navy-2 p-[14px] text-[12px] leading-[1.45]">
        <div className="flex items-center gap-2 text-[13px] font-bold text-white">
          <Icon name="shield" size={16} color="#7DD3E0" strokeWidth={2} />
          GDPR compliant
        </div>
        <span>EU data residency · audit log on · encrypted at rest</span>
      </div>
      <div className="flex items-center gap-[10px] px-2 pt-[14px]">
        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-navy-3 text-[13px] font-bold text-white">
          {PRACTICE.signedInInitials}
        </div>
        <div className="flex flex-col text-[13px]">
          <span className="font-semibold text-white">{PRACTICE.doctorName}</span>
          <span className="text-[12px]">{PRACTICE.practiceName}</span>
        </div>
      </div>
    </aside>
  );
}
