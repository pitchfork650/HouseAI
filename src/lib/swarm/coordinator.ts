/**
 * Small swarm coordinator. Agents in a phase run in parallel, each with its own
 * timeout and retries; one agent failing or timing out never blocks the others.
 * Every agent's run (status, timestamped log lines, output) is persisted through a
 * RunStore, so the UI can show live progress and the audit log has every output.
 */

export type LogLine = { t: string; text: string };

export type AgentStatus = "queued" | "running" | "done" | "flag" | "skip" | "failed" | "retry" | "verified" | "submitted";

export type AgentOutcome<O = unknown> = {
  status: AgentStatus;
  badge: string;
  result: string;
  output?: O;
  model?: string;
  promptVersion?: string;
  nextAttemptAt?: Date;
};

export interface AgentCtx {
  log(text: string, at?: Date): void;
  signal: AbortSignal;
  attempt: number;
  now(): Date;
}

export type AgentSpec<I, O = unknown> = {
  name: string;
  scope: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  /** Return a reason to skip this agent (e.g. a required image is missing). */
  skip?(input: I): string | null;
  run(input: I, ctx: AgentCtx): Promise<AgentOutcome<O>>;
  /** Called when every attempt failed. Lets a lane schedule a later retry instead of failing. */
  onExhausted?(err: Error, ctx: AgentCtx): AgentOutcome<O>;
};

export interface RunStore {
  create(order: number, name: string, scope: string): Promise<string>;
  update(id: string, patch: { status?: AgentStatus; badge?: string; log?: LogLine[]; attempts?: number; startedAt?: Date }): Promise<void>;
  finish(id: string, name: string, outcome: AgentOutcome, log: LogLine[], attempts: number): Promise<void>;
}

export class TimeoutError extends Error {
  constructor(public ms: number) {
    super(`Timed out after ${Math.round(ms / 1000)} s`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new TimeoutError(ms);
      ctrl.abort(err);
      reject(err);
    }, ms);
    fn(ctrl.signal).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RunOptions = { now?: () => Date; orderOffset?: number; defaultTimeoutMs?: number; defaultRetries?: number };

/** Create the agent rows up front (queued) so the UI shows every agent immediately. */
export async function registerAgents<I>(store: RunStore, specs: AgentSpec<I, unknown>[], orderOffset = 0): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < specs.length; i++) ids.push(await store.create(orderOffset + i, specs[i].name, specs[i].scope));
  return ids;
}

export async function runAgent<I, O>(store: RunStore, id: string, spec: AgentSpec<I, O>, input: I, opts: RunOptions = {}): Promise<AgentOutcome<O>> {
  const now = opts.now ?? (() => new Date());
  const log: LogLine[] = [];
  const timeoutMs = spec.timeoutMs ?? opts.defaultTimeoutMs ?? 60_000;
  const retries = spec.retries ?? opts.defaultRetries ?? 1;

  const skipReason = spec.skip?.(input);
  if (skipReason) {
    log.push({ t: now().toISOString(), text: `Skipped: ${skipReason}` });
    const outcome: AgentOutcome<O> = { status: "skip", badge: "Skipped", result: skipReason };
    await store.finish(id, spec.name, outcome, log, 0);
    return outcome;
  }

  let lastErr: Error = new Error("not run");
  let attempt = 0;
  let pending = Promise.resolve();
  const flush = () => { pending = pending.then(() => store.update(id, { log: [...log] })).catch(() => {}); };
  await store.update(id, { status: "running", badge: "Running", startedAt: now() });

  for (attempt = 1; attempt <= retries + 1; attempt++) {
    await store.update(id, { attempts: attempt });
    try {
      const outcome = await withTimeout(
        (signal) =>
          spec.run(input, {
            signal,
            attempt,
            now,
            log: (text, at) => { log.push({ t: (at ?? now()).toISOString(), text }); flush(); },
          }),
        timeoutMs,
      );
      await pending;
      await store.finish(id, spec.name, outcome as AgentOutcome, log, attempt);
      return outcome;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      log.push({ t: now().toISOString(), text: lastErr instanceof TimeoutError ? `Timeout (${Math.round(timeoutMs / 1000)} s)` : `Error: ${lastErr.message}` });
      flush();
      if (attempt <= retries) await sleep(spec.retryDelayMs ?? 0);
    }
  }
  await pending;
  const ctx: AgentCtx = { signal: new AbortController().signal, attempt, now, log: (text, at) => log.push({ t: (at ?? now()).toISOString(), text }) };
  const outcome: AgentOutcome<O> = spec.onExhausted?.(lastErr, ctx) ?? { status: "failed", badge: "Failed", result: lastErr.message };
  await store.finish(id, spec.name, outcome as AgentOutcome, log, attempt - 1);
  return outcome;
}

/** Run a phase: all agents in parallel, settle independently. */
export async function runPhase<I>(store: RunStore, ids: string[], specs: AgentSpec<I, unknown>[], input: I, opts: RunOptions = {}): Promise<AgentOutcome[]> {
  const settled = await Promise.allSettled(specs.map((s, i) => runAgent(store, ids[i], s, input, opts)));
  return settled.map((r) => (r.status === "fulfilled" ? r.value : { status: "failed", badge: "Failed", result: String(r.reason) }));
}

/** In-memory store for tests and dry runs. */
export class MemoryRunStore implements RunStore {
  rows = new Map<string, { order: number; name: string; scope: string; status: AgentStatus; badge: string; log: LogLine[]; attempts: number; outcome?: AgentOutcome }>();
  private n = 0;
  async create(order: number, name: string, scope: string) {
    const id = `a${++this.n}`;
    this.rows.set(id, { order, name, scope, status: "queued", badge: "Queued", log: [], attempts: 0 });
    return id;
  }
  async update(id: string, patch: Parameters<RunStore["update"]>[1]) {
    const r = this.rows.get(id)!;
    Object.assign(r, { ...patch, log: patch.log ?? r.log });
  }
  async finish(id: string, _name: string, outcome: AgentOutcome, log: LogLine[], attempts: number) {
    const r = this.rows.get(id)!;
    Object.assign(r, { status: outcome.status, badge: outcome.badge, log, attempts, outcome });
  }
  byName(name: string) {
    return [...this.rows.values()].find((r) => r.name === name);
  }
}
