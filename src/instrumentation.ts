/** Starts the in-process scheduler (follow-ups, reminders, lane retries) on the Node server. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SCHEDULER_ENABLED === "false") return;
  const { tick } = await import("./lib/scheduler");
  const g = globalThis as unknown as { __houseaiScheduler?: NodeJS.Timeout };
  if (g.__houseaiScheduler) return;
  g.__houseaiScheduler = setInterval(() => {
    tick().catch((e) => console.error("[scheduler]", e));
  }, 60_000);
}
