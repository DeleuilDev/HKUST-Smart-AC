import { Router } from 'express';
import { db } from '../db/database.js';
import type { ActionType, WeeklyMode } from '../db/types.js';
import { requireAuth } from '../middleware/auth.js';
import { scheduler } from '../scheduler/scheduler.js';
import crypto from 'crypto';

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

// Create a one-off range: schedule ON at start and OFF at end (both ISO)
router.post('/range', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { start, end } = req.body || {};
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!start || Number.isNaN(startDate.getTime())) return res.status(400).json({ error: 'Invalid start' });
  if (!end || Number.isNaN(endDate.getTime())) return res.status(400).json({ error: 'Invalid end' });
  if (endDate.getTime() <= startDate.getTime()) return res.status(400).json({ error: 'end must be after start' });
  const groupId = `grp_${crypto.randomBytes(6).toString('hex')}`;

  const onAction = await db.createScheduledAction({
    userId,
    type: 'power_on',
    payload: { groupId, kind: 'range' },
    scheduledAt: startDate.toISOString(),
    status: 'pending',
  });
  const offAction = await db.createScheduledAction({
    userId,
    type: 'power_off',
    payload: { groupId, kind: 'range' },
    scheduledAt: endDate.toISOString(),
    status: 'pending',
  });
  await Promise.all([scheduler.schedule(onAction), scheduler.schedule(offAction)]);
  res.status(201).json({ groupId, items: [onAction, offAction] });
});

// Weekly plan: daysOfWeek [0-6 Sun..Sat], startTime/endTime 'HH:mm' strings, optional from/to dates or weeksCount
router.post('/weekly', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { daysOfWeek, startTime, endTime, fromDate, toDate, weeksCount } = req.body || {};
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return res.status(400).json({ error: 'daysOfWeek required' });
  if (typeof startTime !== 'string' || !/^\d{2}:\d{2}$/.test(startTime)) return res.status(400).json({ error: 'startTime HH:mm required' });
  if (typeof endTime !== 'string' || !/^\d{2}:\d{2}$/.test(endTime)) return res.status(400).json({ error: 'endTime HH:mm required' });
  const [sH, sM] = startTime.split(':').map((n: string) => parseInt(n, 10));
  const [eH, eM] = endTime.split(':').map((n: string) => parseInt(n, 10));
  const startRef = fromDate ? new Date(fromDate) : new Date();
  if (Number.isNaN(startRef.getTime())) return res.status(400).json({ error: 'Invalid fromDate' });
  const endRef = toDate ? new Date(toDate) : new Date(startRef.getTime() + (weeksCount && Number.isFinite(weeksCount) ? Number(weeksCount) : 8) * 7 * 24 * 3600 * 1000);
  if (Number.isNaN(endRef.getTime())) return res.status(400).json({ error: 'Invalid toDate' });
  if (endRef.getTime() <= startRef.getTime()) return res.status(400).json({ error: 'toDate must be after fromDate' });

  const groupId = `grp_${crypto.randomBytes(6).toString('hex')}`;
  const items: any[] = [];
  const daySet = new Set<number>(daysOfWeek.map((d: any) => Number(d)));

  // Iterate days from startRef to endRef inclusive
  const cursor = new Date(startRef.getFullYear(), startRef.getMonth(), startRef.getDate());
  while (cursor.getTime() <= endRef.getTime()) {
    const dow = cursor.getDay(); // 0..6 Sun..Sat
    if (daySet.has(dow)) {
      const onAt = new Date(cursor);
      onAt.setHours(sH, sM, 0, 0);
      const offAt = new Date(cursor);
      offAt.setHours(eH, eM, 0, 0);
      if (offAt.getTime() > onAt.getTime()) {
        items.push({ at: onAt, type: 'power_on' }, { at: offAt, type: 'power_off' });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const created = [] as any[];
  for (const it of items) {
    const act = await db.createScheduledAction({
      userId,
      type: it.type as ActionType,
      payload: { groupId, kind: 'weekly', startTime, endTime, dow: it.type === 'power_on' ? undefined : undefined },
      scheduledAt: it.at.toISOString(),
      status: 'pending',
    });
    created.push(act);
  }
  await Promise.all(created.map((a) => scheduler.schedule(a)));
  res.status(201).json({ groupId, items: created });
});

// Smart cycle: repeat ON-with-timer (set_timer) followed by pause until total reached
// Body: { runMinutes: number, pauseMinutes: number, totalMinutes: number, startAt?: ISOString }
router.post('/smart-cycle', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { runMinutes, pauseMinutes, totalMinutes, startAt } = req.body || {};

  const toInt = (v: any) => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^\d+$/.test(v)) return Math.trunc(Number(v));
    return NaN;
  };
  const run = toInt(runMinutes);
  const pause = toInt(pauseMinutes);
  const total = toInt(totalMinutes);

  if (!Number.isFinite(run) || run <= 0) return res.status(400).json({ error: 'runMinutes must be > 0' });
  if (!Number.isFinite(pause) || pause < 0) return res.status(400).json({ error: 'pauseMinutes must be >= 0' });
  if (!Number.isFinite(total) || total <= 0) return res.status(400).json({ error: 'totalMinutes must be > 0' });
  if (run > 24 * 60 || total > 24 * 60 * 7) return res.status(400).json({ error: 'runMinutes <= 1440 and totalMinutes <= 10080 required' });

  const start = startAt ? new Date(startAt) : new Date();
  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Invalid startAt' });

  const groupId = `grp_${crypto.randomBytes(6).toString('hex')}`;
  const items: { at: Date; minutes: number }[] = [];

  let remaining = total;
  let current = new Date(start);
  let cycles = 0;
  while (remaining > 0) {
    cycles++;
    if (cycles > 500) return res.status(400).json({ error: 'Too many cycles (max 500)' });
    const thisRun = Math.min(run, remaining);
    items.push({ at: new Date(current), minutes: thisRun });
    remaining -= thisRun;
    // advance to next cycle start: current + thisRun (run) + pause
    current = new Date(current.getTime() + (thisRun + pause) * 60_000);
  }

  const created = [] as any[];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const act = await db.createScheduledAction({
      userId,
      type: 'set_timer' as ActionType,
      payload: { groupId, kind: 'smart', runMinutes: run, pauseMinutes: pause, totalMinutes: total, cycleIndex: i + 1, minutes: it.minutes },
      scheduledAt: it.at.toISOString(),
      status: 'pending',
    });
    created.push(act);
  }
  await Promise.all(created.map((a) => scheduler.schedule(a)));
  res.status(201).json({ groupId, items: created });
});

// Groups summary for the user (by payload.groupId)
router.get('/groups', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const actions = await db.listScheduledActionsByUser(userId);
  type GroupInfo = { id: string; count: number; pending: number; first?: string; last?: string };
  const groups = new Map<string, GroupInfo>();
  for (const a of actions) {
    const gid = (a.payload as any)?.groupId as string | undefined;
    if (!gid) continue;
    let g = groups.get(gid);
    if (!g) {
      g = { id: gid, count: 0, pending: 0, first: undefined, last: undefined };
    }
    g.count++;
    if (a.status === 'pending') g.pending++;
    if (!g.first || a.scheduledAt < g.first) g.first = a.scheduledAt;
    if (!g.last || a.scheduledAt > g.last) g.last = a.scheduledAt;
    groups.set(gid, g);
  }
  res.json({ items: Array.from(groups.values()) });
});

// Cancel all pending actions in a group
router.delete('/groups/:id', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const gid = req.params.id;
  const actions = await db.listScheduledActionsByUser(userId);
  const targets = actions.filter((a) => a.status === 'pending' && (a.payload as any)?.groupId === gid);
  await Promise.all(targets.map((a) => scheduler.cancel(a.id)));
  await Promise.all(targets.map((a) => db.updateScheduledAction(a.id, { status: 'canceled' })));
  res.json({ ok: true, canceled: targets.length });
});

// Weekly plan persistence for the current user
router.get('/weekly-plan', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const plan = await db.getWeeklyScheduleByUser(userId);
  if (!plan) return res.json({ plan: null });
  res.json({ plan });
});

router.put('/weekly-plan', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { mode, slots } = req.body || {};
  const m = (mode === 'off' ? 'off' : 'on') as WeeklyMode;
  if (!Array.isArray(slots)) return res.status(400).json({ error: 'slots[] required' });
  if (slots.length !== 168) return res.status(400).json({ error: 'slots must be length 168' });
  const normalized = slots.map((v: any) => Boolean(v));
  const plan = await db.upsertWeeklySchedule(userId, { mode: m, slots: normalized });
  res.status(200).json({ plan });
});

export default router;
