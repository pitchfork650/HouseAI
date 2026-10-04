import { dayEyebrow } from "@/lib/clock";
import { PRIO, PRIORITY_KEY, PRIORITIES, asPriority } from "@/lib/priority";
import { ruleChips, SCHEDULE_RULES } from "@/lib/rules/schedule-rules";
import { DEFAULT_DAY, durationLabel, scheduleView } from "@/lib/schedule";
import { Icon, type IconName } from "@/components/icons";
import { Card, SolidPill } from "@/components/ui";
import { ScheduleActions } from "@/components/schedule/ScheduleActions";

const H = 72;
const START = SCHEDULE_RULES.dayStart / 60;
const END = SCHEDULE_RULES.dayEnd / 60;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : DEFAULT_DAY;
  const v = await scheduleView(date);
  const stats: { value: number; label: string; icon: IconName; color: string; tile: string }[] = [
    { value: v.stats.placed, label: "Appointments placed", icon: "calendar", color: "#1A56DB", tile: "#E8EFFC" },
    { value: v.stats.longBeforeNoon, label: "Long cases before noon", icon: "clock", color: "#0B7285", tile: "#E3F4F6" },
    { value: v.stats.holds, label: "Emergency slot held", icon: "pulse", color: "#C2410C", tile: "#FDEDE3" },
    { value: v.stats.needInput, label: "Need input", icon: "warning", color: "#9A3412", tile: "#FDEDE3" },
  ];
  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const gridH = (END - START) * H;
  const lunchTop = (SCHEDULE_RULES.lunch.start / 60 - START) * H;
  const lunchH = ((SCHEDULE_RULES.lunch.end - SCHEDULE_RULES.lunch.start) / 60) * H;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[12px] tracking-[0.1em] text-muted">{dayEyebrow(date)}</div>
          <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.01em]">Calendar builder</h1>
        </div>
        <ScheduleActions date={date} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-[14px] rounded-[14px] border border-border bg-white px-4 py-[14px] shadow-card">
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px]" style={{ background: s.tile }}>
              <Icon name={s.icon} size={20} color={s.color} />
            </div>
            <div className="flex flex-col">
              <span className="text-[24px] font-extrabold leading-[1.1]">{s.value}</span>
              <span className="text-[13px] text-muted">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[13px]">
        {ruleChips().map((r) => (
          <span key={r} className="inline-flex items-center gap-[6px] rounded-full bg-teal-tint px-3 py-[6px] font-semibold text-teal-dark">
            <Icon name="check" size={14} strokeWidth={2.4} />
            {r}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-[18px]">
        <Card className="min-w-0 overflow-hidden" style={{ flex: "1 1 280px" }}>
          <div className="border-b border-border-soft px-[18px] py-4">
            <h2 className="m-0 text-[16px] font-bold">Needs input</h2>
            <div className="mt-1 text-[13px] text-muted">
              {v.counts.imported} imported · {v.counts.placed} placed · {v.counts.blocked} blocked
            </div>
          </div>
          {v.queue.length === 0 ? <div className="border-b border-row-line px-[18px] py-[14px] text-[13px] text-muted">Nothing blocked.</div> : null}
          {v.queue.map((q) => (
            <div key={q.id} className="flex flex-col gap-[6px] border-b border-row-line px-[18px] py-[14px]">
              <div className="flex justify-between gap-2">
                <span className="text-[14px] font-bold">
                  {q.patientId} · {q.name}
                </span>
                <SolidPill p={q.priority} />
              </div>
              <div className="text-[13px] text-ink-2">
                {q.procedure} · {durationLabel(q.durationMin)}
              </div>
              <div className="flex items-center gap-[6px] text-[12px] font-semibold text-p1-pill">
                <Icon name="warning" size={13} strokeWidth={2.2} />
                {q.blocker}
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-2 bg-subtle px-[18px] py-4 text-[13px] text-ink-2">
            <div className="font-mono text-[11px] tracking-[0.1em] text-muted">PRIORITY</div>
            {PRIORITIES.map((p) => (
              <div key={p} className="flex items-center gap-2">
                <SolidPill p={p} />
                {PRIORITY_KEY[p]}
              </div>
            ))}
          </div>
        </Card>

        <section className="min-w-0 overflow-x-auto rounded-[16px] border border-border bg-white shadow-card" style={{ flex: "999 1 640px" }}>
          <div className="min-w-[760px]">
            <div className="grid border-b border-border-soft bg-subtle" style={{ gridTemplateColumns: `64px repeat(${v.providers.length}, minmax(0, 1fr))` }}>
              <div />
              {v.providers.map((p) => (
                <div key={p.id} className="flex items-center gap-[10px] p-3">
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{p.initials}</div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold">{p.name}</span>
                    <span className="text-[12px] text-muted">{p.chair}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${v.providers.length}, minmax(0, 1fr))` }}>
              <div className="relative" style={{ height: gridH }}>
                {hours.map((h) => (
                  <div key={h} className="absolute right-[10px] font-mono text-[11px] text-muted" style={{ top: (h - START) * H + 4 }}>
                    {h > 12 ? h - 12 : h} {h < 12 ? "am" : "pm"}
                  </div>
                ))}
              </div>
              {v.providers.map((p) => (
                <div
                  key={p.id}
                  className="relative border-l border-row-line"
                  style={{ height: gridH, backgroundImage: `repeating-linear-gradient(to bottom, #EEF2F6 0, #EEF2F6 1px, transparent 1px, transparent ${H}px)` }}
                >
                  <div
                    className="absolute inset-x-0 flex items-center justify-center font-mono text-[11px] text-muted-2"
                    style={{ top: lunchTop, height: lunchH, background: "repeating-linear-gradient(45deg, #F6F9FC 0, #F6F9FC 6px, #EDF2F7 6px, #EDF2F7 12px)" }}
                  >
                    LUNCH
                  </div>
                  {v.appts
                    .filter((a) => a.providerId === p.id)
                    .map((a) => {
                      const c = PRIO[asPriority(a.priority)];
                      const top = (a.startMin / 60 - START) * H + 2;
                      const height = ((a.endMin - a.startMin) / 60) * H - 4;
                      const compact = height < 30;
                      return (
                        <div
                          key={a.id}
                          className={`absolute left-[6px] right-[6px] box-border flex overflow-hidden rounded-[9px] ${compact ? "items-center gap-2 px-[8px] py-0" : "flex-col gap-[3px] px-[10px] py-[7px]"}`}
                          style={{
                            top,
                            height,
                            background: a.isHold ? "#FFFFFF" : c.tint,
                            border: `1px ${a.isHold ? "dashed" : "solid"} ${a.isHold ? "#F3B48F" : c.border}`,
                            color: a.isHold ? "#9A3412" : c.text,
                            boxShadow: "0 1px 2px rgba(11,31,58,0.06)",
                          }}
                          title={`${a.title} · ${a.meta}`}
                        >
                          {compact ? (
                            <span className="truncate text-[11px] leading-none">
                              <b>{a.title}</b> · {a.meta}
                            </span>
                          ) : (
                            <>
                              <div className="flex items-center justify-between gap-[6px]">
                                <span className="text-[13px] font-bold">{a.title}</span>
                                <SolidPill p={a.priority} />
                              </div>
                              <div className="text-[12px] opacity-85">{a.meta}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
