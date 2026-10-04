/**
 * Agents read time through a Clock so the same lane code runs in real time (UI)
 * or on a virtual timeline (seed, tests). Mock adapters "spend" simulated time.
 */
export interface Clock {
  now(): Date;
  sleep(ms: number): Promise<void>;
  fork(): Clock;
}

/** Real time; simulated waits are scaled down so a mock run takes a second or two. */
export class RealClock implements Clock {
  constructor(private scale = Number(process.env.MOCK_TIME_SCALE ?? 0.002), private base: () => Date = () => new Date()) {}
  now() { return this.base(); }
  sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, Math.round(ms * this.scale))); }
  fork(): Clock { return new RealClock(this.scale, this.base); }
}

/** Virtual time: sleeping advances the clock instantly. Each fork has its own timeline. */
export class VirtualClock implements Clock {
  constructor(private t: number) {}
  now() { return new Date(this.t); }
  async sleep(ms: number) { this.t += ms; }
  fork(): Clock { return new VirtualClock(this.t); }
}
