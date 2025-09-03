import { db } from '../db/database.js';
import type { ScheduledAction } from '../db/types.js';
import { executeAction } from './executor.js';

type Timer = ReturnType<typeof setTimeout>;

export class InProcessScheduler {
  private timers = new Map<string, Timer>();

  start() {
    // schedule all pending actions on boot
    const pending = db.listPendingActions();
    for (const act of pending) this.schedule(act);
  }

  schedule(action: ScheduledAction) {
    // clear existing
    this.cancel(action.id);
    const eta = new Date(action.scheduledAt).getTime() - Date.now();
    const delay = Math.max(0, eta);
    const timer = setTimeout(async () => {
      try {
        db.updateScheduledAction(action.id, { status: 'running' });
        const fresh = db.getScheduledAction(action.id)!;
        const result = await executeAction(fresh);
        if (result.ok) {
          db.updateScheduledAction(action.id, { status: 'completed', executedAt: new Date().toISOString(), lastError: undefined });
        } else {
          db.updateScheduledAction(action.id, { status: 'failed', executedAt: new Date().toISOString(), lastError: result.error });
        }
      } finally {
        this.timers.delete(action.id);
      }
    }, delay);
    this.timers.set(action.id, timer);
  }

  cancel(id: string) {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }
}

export const scheduler = new InProcessScheduler();
