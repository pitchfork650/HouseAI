"use client";

import { Fragment, useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (sticky; fires once unless `repeat`). */
export function useInView<T extends Element>(opts: { margin?: string; repeat?: boolean } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { margin = "0px 0px -10% 0px", repeat = false } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) return setInView(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (!repeat) io.disconnect();
        } else if (repeat) setInView(false);
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, repeat]);
  return [ref, inView] as const;
}

export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Fades, lifts and un-blurs children into view. Adds `in` so CSS can start child animations. */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const [ref, shown] = useInView<HTMLDivElement>();
  return (
    <Tag ref={ref as React.Ref<never>} className={`reveal ${shown ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Splits a line into words that rise in one after another. */
export function Words({ text, className = "", start = 0, step = 55 }: { text: string; className?: string; start?: number; step?: number }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <Fragment key={i}>
          <span className="word-mask">
            <span className="word" style={{ animationDelay: `${start + i * step}ms` }}>
              {w}
            </span>
          </span>{" "}
        </Fragment>
      ))}
    </span>
  );
}

/** Counts up to `value` when it first scrolls into view. */
export function CountUp({ value, duration = 1400 }: { value: number; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(value);
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);
  return (
    <span ref={ref} aria-label={String(value)} className="tabular-nums">
      {n}
    </span>
  );
}

/** Product shot that starts tilted back and settles flat as it scrolls up the viewport. */
export function ScrollTilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top of the shot is at the bottom of the viewport, 1 when it reaches 25% from the top.
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
      const e = 1 - Math.pow(1 - p, 3);
      el.style.setProperty("--tilt", `${(1 - e) * 14}deg`);
      el.style.setProperty("--tilt-scale", `${0.94 + e * 0.06}`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className={`tilt-stage ${className}`}>
      <div ref={ref} className="tilt">
        {children}
      </div>
    </div>
  );
}
