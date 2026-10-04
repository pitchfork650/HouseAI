import Link from "next/link";
import { Icon } from "./icons";
import type { NavItem } from "./Sidebar";

/** Horizontal nav for the full-width Flow page (which has no sidebar). */
export function TopNav({ items }: { items: NavItem[] }) {
  return (
    <nav aria-label="Main" className="relative flex flex-wrap items-center gap-1 max-[800px]:-mx-1 max-[800px]:flex-nowrap max-[800px]:overflow-x-auto max-[800px]:px-1 [scrollbar-width:none]">
      {items.map((it) => {
        const active = it.key === "flow";
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] flex-none items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[14px] no-underline hover:bg-navy-2 hover:text-white ${
              active ? "bg-navy-2 font-semibold text-white" : "text-on-navy"
            }`}
          >
            <Icon name={it.icon} size={18} color={active ? "#7DD3E0" : "currentColor"} />
            {it.label}
            {it.count ? (
              <span className="rounded-full px-2 py-[2px] text-[11px] text-white" style={{ background: it.countTone === "orange" ? "#C2410C" : "#0B7285" }}>
                {it.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
