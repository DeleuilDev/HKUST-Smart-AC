import { Router } from 'express';
import { db } from '../db/database.js';
import type { ActionType } from '../db/types.js';
import { requireAuth } from '../middleware/auth.js';
import { scheduler } from '../scheduler/scheduler.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const actions = await db.listScheduledActionsByUser(userId);
  res.json({ items: actions });
});

router.post('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { type, payload, scheduledAt } = req.body || {};
  if (!type || !['power_on', 'power_off', 'set_timer'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required (ISO string)' });
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid scheduledAt' });

  const action = await db.createScheduledAction({
    userId,
    type: type as ActionType,
    payload: payload && typeof payload === 'object' ? payload : undefined,
    scheduledAt: when.toISOString(),
    status: 'pending',
  });

  await scheduler.schedule(action);
  res.status(201).json({ action });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const id = req.params.id;
  const action = await db.getScheduledAction(id);
  if (!action || action.userId !== userId) return res.status(404).json({ error: 'Not found' });
  if (action.status !== 'pending') return res.status(400).json({ error: `Cannot cancel action with status ${action.status}` });
  await scheduler.cancel(id);
  await db.updateScheduledAction(id, { status: 'canceled' });
  res.json({ ok: true });
});

export default router;
