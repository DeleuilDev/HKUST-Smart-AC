import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/database.js';
import { smartMode } from '../scheduler/smartMode.js';
import { resolveUserAcToken, acRemoteFetch } from '../util/acProxy.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const cfg = await db.getSmartModeByUser(userId);
  res.json({ config: cfg || null });
});

router.post('/', async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { runMinutes, pauseMinutes, totalMinutes, startAt, active } = req.body || {};
  // Guard: prevent starting another Smart Mode when one is already active
  try {
    const existing = await db.getSmartModeByUser(userId);
    if (existing?.active && active !== false) {
      return res.status(409).json({ error: 'Smart mode already active. Stop current one first.' });
    }
  } catch {}
  const toInt = (v: any) => (typeof v === 'number' && Number.isFinite(v)) ? Math.trunc(v) : (typeof v === 'string' && /^\d+$/.test(v) ? Math.trunc(Number(v)) : NaN);
  const run = toInt(runMinutes);
  const pause = toInt(pauseMinutes);
  const total = totalMinutes == null ? undefined : toInt(totalMinutes);
  if (!(run > 0)) return res.status(400).json({ error: 'runMinutes must be > 0' });
  if (!(pause >= 0)) return res.status(400).json({ error: 'pauseMinutes must be >= 0' });
  if (total !== undefined && !(total > 0)) return res.status(400).json({ error: 'totalMinutes must be > 0 if provided' });
  let startIso: string | null | undefined = undefined;
  if (startAt != null) {
    const d = new Date(startAt);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid startAt' });
    startIso = d.toISOString();
  }
  const cfg = await smartMode.setConfig(userId, { runMinutes: run, pauseMinutes: pause, totalMinutes: total, startAt: startIso, active: active ?? true });
  res.status(200).json({ config: cfg });
});

router.delete('/', async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  await smartMode.stop(userId);
  // Also turn the AC OFF when stopping Smart Mode
  try {
    const token = await resolveUserAcToken(userId);
    if (token) {
      const result = await acRemoteFetch('/prepaid/toggle-status', token, { method: 'POST', body: JSON.stringify({ toggle: { status: 0 } }) });
      const turnedOff = result.status >= 200 && result.status < 300;
      return res.json({ ok: true, turnedOff });
    }
  } catch {}
  res.json({ ok: true, turnedOff: false });
});

export default router;
