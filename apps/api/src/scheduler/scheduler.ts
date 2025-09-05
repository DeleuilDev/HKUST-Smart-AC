import { db } from '../db/database.js';
import type { ScheduledAction } from '../db/types.js';
import { executeAction } from './executor.js';

type Timer = ReturnType<typeof setTimeout>;

export class InProcessScheduler {
  private timers = new Map<string, Timer>();

  async start() {
    // schedule all pending actions on boot
    const pending = await db.listPendingActions();
    for (const act of pending) await this.schedule(act);
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
}

export const scheduler = new InProcessScheduler();
