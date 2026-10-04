"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

export type WorkflowStep = { num: string; title: string; icon: IconName; tag: string; body: string; swarm?: boolean; href: string };

/** Sticky-heading step list: the rail fills and the step nearest the viewport centre lights up as you scroll. */
export function Workflow({ steps }: { steps: WorkflowStep[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight * 0.5;
      const items = Array.from(list.querySelectorAll<HTMLElement>("[data-step]"));
      let best = 0;
      let bestDist = Infinity;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setActive(best);
      const lr = list.getBoundingClientRect();
      setProgress(Math.min(1, Math.max(0, (mid - lr.top) / lr.height)));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <ol ref={listRef} className="relative m-0 list-none p-0">
      <span className="absolute bottom-[30px] left-[15px] top-[30px] w-px bg-lp-line" aria-hidden="true" />
      <span className="absolute left-[15px] top-[30px] w-px origin-top bg-lp-accent transition-[height] duration-150 ease-out" style={{ height: `calc((100% - 60px) * ${progress})` }} aria-hidden="true" />
      {steps.map((s, i) => {
        const on = i === active;
        const passed = i <= active;
        return (
          <li key={s.num} data-step className="relative flex gap-5 py-[14px]">
            <span
              className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full border transition-all duration-500 ${
                passed ? (s.swarm ? "border-lp-accent bg-lp-accent" : "border-lp-ink bg-lp-ink") : "border-lp-line bg-lp-surface"
              } ${on ? "scale-110" : ""}`}
            >
              <Icon name={s.icon} size={15} color={passed ? "#FFFFFF" : "#8A94A6"} />
            </span>
            <Link href={s.href} className={`group flex min-w-0 flex-1 flex-col gap-1 pt-[4px] no-underline transition-opacity duration-500 ${on ? "opacity-100" : "opacity-45 hover:opacity-80"}`}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-lp-faint">{s.num}</span>
                <h3 className="m-0 flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em] text-lp-ink">
                  {s.title}
                  <span className="text-lp-faint opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" aria-hidden="true">
                    →
                  </span>
                </h3>
                <span className={`ml-auto whitespace-nowrap rounded-full px-2 py-[2px] text-[11px] font-medium max-[480px]:hidden ${s.swarm ? "bg-lp-accent-tint text-lp-accent" : "bg-lp-chip text-lp-muted"}`}>{s.tag}</span>
              </div>
              <p className="m-0 max-w-[580px] pl-[30px] text-[14px] leading-[1.55] text-lp-muted max-[480px]:pl-0">{s.body}</p>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
