import { db } from '../db/database.js';
import type { ScheduledAction, WeeklySchedule } from '../db/types.js';
import { executeAction } from './executor.js';
import { acRemoteFetch, resolveUserAcToken } from '../util/acProxy.js';

type Timer = ReturnType<typeof setTimeout>;

export class InProcessScheduler {
  private timers = new Map<string, Timer>();
  private weeklyTimer: Timer | null = null;
  private lastMinuteSeen: number | null = null;
  private appliedState = new Map<string, 'on'|'off'>(); // userId -> last applied

  async start() {
    // schedule all pending actions on boot
    const pending = await db.listPendingActions();
    for (const act of pending) await this.schedule(act);
    this.startWeeklyWatcher();
  }

  async schedule(action: ScheduledAction) {
    // clear existing
    await this.cancel(action.id);
    const eta = new Date(action.scheduledAt).getTime() - Date.now();
    const delay = Math.max(0, eta);
    const timer = setTimeout(async () => {
      try {
        await db.updateScheduledAction(action.id, { status: 'running' });
        const fresh = await db.getScheduledAction(action.id);
        if (!fresh) return;
        const result = await executeAction(fresh);
        if (result.ok) {
          await db.updateScheduledAction(action.id, { status: 'completed', executedAt: new Date().toISOString(), lastError: undefined });
        } else {
          await db.updateScheduledAction(action.id, { status: 'failed', executedAt: new Date().toISOString(), lastError: result.error });
        }
      } finally {
        this.timers.delete(action.id);
      }
    }, delay);
    this.timers.set(action.id, timer);
  }

  async cancel(id: string) {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }

  private startWeeklyWatcher() {
    if (this.weeklyTimer) clearInterval(this.weeklyTimer);
    this.weeklyTimer = setInterval(async () => {
      try {
        const now = new Date();
        const minuteBucket = Math.floor(now.getTime() / 60000);
        if (this.lastMinuteSeen === minuteBucket) return;
        this.lastMinuteSeen = minuteBucket;
        // Only act on exact hour boundaries (00 minute)
        if (now.getMinutes() !== 0) return;
        const all = await db.listAllWeeklySchedules();
        await Promise.all(all.map((plan) => this.applyWeeklyFor(plan, now)));
      } catch (e) {
        // swallow errors to keep the loop alive
      }
    }, 15_000);
  }

  private computeDesired(plan: WeeklySchedule, at: Date): 'on' | 'off' | undefined {
    if (!Array.isArray(plan.slots) || plan.slots.length !== 168) return undefined;
    const dow = at.getDay(); // 0..6
    const hour = at.getHours();
    const idx = dow * 24 + hour;
    const selected = !!plan.slots[idx];
    const mode = plan.mode || 'on';
    const desiredOn = mode === 'on' ? selected : !selected;
    return desiredOn ? 'on' : 'off';
  }

  private async applyWeeklyFor(plan: WeeklySchedule, at: Date) {
    const desired = this.computeDesired(plan, at);
    if (!desired) return;
    const last = this.appliedState.get(plan.userId);
    if (last === desired) return; // already applied
    // Toggle upstream
    const token = await resolveUserAcToken(plan.userId);
    if (!token) return;
    const status = desired === 'on' ? 1 : 0;
    const upstream: any = { toggle: { status } };
    const result = await acRemoteFetch('/prepaid/toggle-status', token, { method: 'POST', body: JSON.stringify(upstream) });
    if (result.status >= 200 && result.status < 300) {
      this.appliedState.set(plan.userId, desired);
    }
  }
}

export const scheduler = new InProcessScheduler();
