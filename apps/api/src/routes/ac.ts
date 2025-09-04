import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/database.js';
import { acRemoteFetch, resolveUserAcToken, parsePowerStatus } from '../util/acProxy.js';

// AC routes that proxy the school API and present simplified responses
const router = Router();

// Proxy helpers live in util/acProxy

// All routes below require a valid backend JWT
router.use(requireAuth);

/**
 * Resolve user context and extract the CAS token once per request.
 * Responds with an error (404/400) and returns undefined when missing.
 */
function getACContext(req: Request, res: Response): { userId: string; token: string } | undefined {
  const { userId } = (req as any).user as { userId: string };
  const user = db.getUser(userId);
  if (!user) {
    res.status(404).json({ errorMessage: 'User not found' });
    return undefined;
  }
  const token = resolveUserAcToken(userId);
  if (!token) {
    res.status(400).json({ errorMessage: 'Missing CAS token for user' });
    return undefined;
  }
  return { userId, token };
}

// Balance proxy
router.get('/balance', async (req, res) => {
  const ctx = getACContext(req, res);
  if (!ctx) return;

  const result = await acRemoteFetch('/prepaid/ac-balance', ctx.token, { method: 'GET' });
  if (result.status >= 200 && result.status < 300) {
    const raw = result.body as any;
    const ac = (raw && typeof raw === 'object' && raw.ac_data) ? raw.ac_data : raw;
    const out = {
      totalPaidInMinute: ac?.total_paid,
      balance: ac?.balance,
      chargeUnit: ac?.charge_unit,
      freeMode: ac?.free_mode,
      billingStartDate: ac?.billing_start_date,
      billingEndDate: ac?.billing_end_date,
    };
    return res.status(200).json(out);
  }
  res.status(result.status).json(result.body);
});

// Current AC status proxy
router.get('/status', async (req, res) => {
  const ctx = getACContext(req, res);
  if (!ctx) return;

  const result = await acRemoteFetch('/prepaid/ac-status', ctx.token, { method: 'GET' });
  res.status(result.status).json(result.body);
});

// Billing cycle detailed information
router.get('/billing-detail', async (req, res) => {
  const ctx = getACContext(req, res);
  if (!ctx) return;

  const result = await acRemoteFetch('/prepaid/billing-cycle-details', ctx.token, { method: 'GET' });
  res.status(result.status).json(result.body);
});

// Billing cycles overview
router.get('/billing-cycles', async (req, res) => {
  const ctx = getACContext(req, res);
  if (!ctx) return;

  const result = await acRemoteFetch('/prepaid/billing-cycles', ctx.token, { method: 'GET' });
  res.status(result.status).json(result.body);
});

// Top-up history for the current user
router.get('/topup-history', async (req, res) => {
  const ctx = getACContext(req, res);
  if (!ctx) return;

  const result = await acRemoteFetch('/prepaid/topup-history', ctx.token, { method: 'GET' });
  res.status(result.status).json(result.body);
});

// Power control with optional auto-off timer (minutes or endDate)
router.post('/power', async (req, res) => {
  const ctx = getACContext(req, res);
  if (!ctx) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const candidateStatus = parsePowerStatus(body);
  if (!(candidateStatus === 0 || candidateStatus === 1)) {
    return res.status(400).json({ errorMessage: 'Provide power payload: { action: "on"|"off" }' });
  }

  // Optional timer support via endDate or minutes (integer)
  function computeTimerISO(b: any): string | undefined {
    const now = Date.now();
    if (typeof b?.endDate === 'string') {
      const d = new Date(b.endDate);
      if (!Number.isNaN(d.getTime()) && d.getTime() > now) return d.toISOString();
    }
    const getInt = (v: any): number | undefined => {
      if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
      if (typeof v === 'string' && /^\d+$/.test(v)) return Math.trunc(Number(v));
      return undefined;
    };
    const minutes = getInt(b?.minutes);
    if (minutes && minutes > 0) return new Date(now + minutes * 60_000).toISOString();
    return undefined;
  }

  const upstream: any = { toggle: { status: candidateStatus } };
  if (candidateStatus === 1) {
    const timerISO = computeTimerISO(body);
    if (timerISO) upstream.toggle.timer = timerISO;
  }

  const result = await acRemoteFetch('/prepaid/toggle-status', ctx.token, { method: 'POST', body: JSON.stringify(upstream) });
  if (result.status >= 200 && result.status < 300) {
    const msg = candidateStatus === 1 ? 'AirConditioner turned on.' : 'AirConditioner turned off.';
    res.status(200).json({ message: msg });
  } else {
    const raw = String((result.body as any)?.errorMessage || '').toLowerCase();

    // Handle "already turned on/off" errors
    const mentionsAlready = raw.includes('already');
    const mentionsAircon = raw.includes('aircon') || raw.includes('air conditioner');
    const mentionsTurned = raw.includes('turned');
    if (mentionsAircon && mentionsAlready && mentionsTurned) {
      const msg = candidateStatus === 1 ? 'AirCon already turned-on' : 'AirCon already turned-off';
      return res.status(409).json({ errorMessage: msg });
    }
    res.status(result.status).json(result.body);
  }
});

// Removed: /ac/toggle, /ac/run-for and /ac/power-for (consolidated into /ac/power)

export default router;
