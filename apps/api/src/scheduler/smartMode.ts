import { db } from '../db/database.js';
import type { SmartModeConfig } from '../db/types.js';
import { acRemoteFetch, resolveUserAcToken } from '../util/acProxy.js';

type Timer = ReturnType<typeof setTimeout>;

export class SmartModeManager {
  private timers = new Map<string, Timer>(); // userId -> timer

  async start() {
    const active = await db.listActiveSmartModes();
    for (const cfg of active) {
      this.planNext(cfg.userId, cfg);
    }
  }

  async setConfig(userId: string, input: { runMinutes: number; pauseMinutes: number; totalMinutes?: number; startAt?: string | null; active?: boolean }) {
    const cfg = await db.upsertSmartMode(userId, input);
    if (cfg.active) this.planNext(userId, cfg); else await this.stop(userId);
    return cfg;
  }

  async stop(userId: string) {
    const t = this.timers.get(userId);
    if (t) { clearTimeout(t); this.timers.delete(userId); }
    await db.updateSmartMode(userId, { active: false, phase: 'idle', nextAt: undefined });
  }

  private async planNext(userId: string, cfg?: SmartModeConfig) {
    if (!cfg) cfg = await db.getSmartModeByUser(userId);
    if (!cfg || !cfg.active) return;
    const now = Date.now();
    const startAt = cfg.startAt ? new Date(cfg.startAt).getTime() : now;
    const nextAt = Math.max(startAt, now);
    const delay = Math.max(0, nextAt - now);
    const t = this.timers.get(userId);
    if (t) { clearTimeout(t); this.timers.delete(userId); }

    const timer = setTimeout(async () => {
      // Before starting, re-load state to observe cancellations
      const latest = await db.getSmartModeByUser(userId);
      if (!latest || !latest.active) return;
      const token = await resolveUserAcToken(userId);
      if (!token) return;
      const run = Math.max(1, Math.trunc(latest.runMinutes));
      const pause = Math.max(0, Math.trunc(latest.pauseMinutes));
      const remaining = latest.remainingMinutes != null ? Math.max(0, Math.trunc(latest.remainingMinutes)) : undefined;
      const thisRun = remaining != null ? Math.max(0, Math.min(run, remaining)) : run;
      if (thisRun <= 0) { await this.stop(userId); return; }

      const start = new Date();
      const ends = new Date(start.getTime() + thisRun * 60_000);
      await db.updateSmartMode(userId, { phase: 'running', startedAt: start.toISOString(), endsAt: ends.toISOString() });

      // Turn ON with timer
      const upstream: any = { toggle: { status: 1, timer: ends.toISOString() } };
      const result = await acRemoteFetch('/prepaid/toggle-status', token, { method: 'POST', body: JSON.stringify(upstream) });
      if (!(result.status >= 200 && result.status < 300)) {
        // If failed, stop the mode to avoid loops
        await this.stop(userId);
        return;
      }

      // After ON, plan next start after run + pause
      const after = new Date(ends.getTime() + pause * 60_000);
      const nextRemaining = remaining != null ? Math.max(0, remaining - thisRun) : undefined;
      await db.updateSmartMode(userId, {
        remainingMinutes: nextRemaining,
        phase: pause > 0 ? 'paused' : 'idle',
        nextAt: after.toISOString(),
        startAt: after.toISOString(),
      });

      // If finished (no remaining), stop; else schedule next
      const done = nextRemaining != null && nextRemaining <= 0;
      if (done) {
        await this.stop(userId);
        return;
      }
      this.planNext(userId);
    }, delay);
    this.timers.set(userId, timer);
    await db.updateSmartMode(userId, { nextAt: new Date(Date.now() + delay).toISOString(), phase: delay > 0 ? 'paused' : 'running' });
  }
}

export const smartMode = new SmartModeManager();

