"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoTile } from "@/components/icons";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "How it works" },
  { href: "#security", label: "Security" },
];

/** Marketing nav: transparent over the hero, frosted with a hairline once the page scrolls. */
export function LandingNav({ demoHref }: { demoHref: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className={`lp-nav sticky top-0 z-40 ${scrolled ? "is-scrolled" : ""}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-6 max-[640px]:px-4">
        <Link href="/" className="flex items-center gap-[10px] text-lp-ink no-underline hover:text-lp-ink">
          <LogoTile size={28} radius={8} glyph={16} />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">HouseAI</span>
        </Link>
        <div className="flex items-center gap-1 max-[760px]:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-md px-3 py-2 text-[14px] text-lp-muted no-underline transition-colors hover:text-lp-ink">
              {l.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/schedule" className="rounded-md px-3 py-2 text-[14px] text-lp-muted no-underline transition-colors hover:text-lp-ink max-[480px]:hidden">
            Sign in
          </Link>
          <Link href={demoHref} className="lp-btn lp-btn-dark h-9 px-4 text-[14px]">
            Open live demo
          </Link>
        </div>
      </nav>
    </div>
  );
}
