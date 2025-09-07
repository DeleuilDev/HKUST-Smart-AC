import type { ScheduledAction } from '../db/types.js';
import { resolveUserAcToken, acRemoteFetch } from '../util/acProxy.js';

function computeTimerISOFromPayload(payload: any): string | undefined {
  const now = Date.now();
  if (typeof payload?.endDate === 'string') {
    const d = new Date(payload.endDate);
    if (!Number.isNaN(d.getTime()) && d.getTime() > now) return d.toISOString();
  }
  const minutes = (() => {
    const v = payload?.minutes;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && /^\d+$/.test(v)) return Math.trunc(Number(v));
    return undefined;
  })();
  if (minutes && minutes > 0) return new Date(now + minutes * 60_000).toISOString();
  return undefined;
}

export async function executeAction(action: ScheduledAction): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = await resolveUserAcToken(action.userId);
    if (!token) return { ok: false, error: 'Missing CAS token' };

    if (action.type === 'power_on' || action.type === 'power_off') {
      const status = action.type === 'power_on' ? 1 : 0;
      const upstream: any = { toggle: { status } };
      if (status === 1) {
        const timerISO = computeTimerISOFromPayload(action.payload || {});
        if (timerISO) upstream.toggle.timer = timerISO;
      }
      const result = await acRemoteFetch('/prepaid/toggle-status', token, { method: 'POST', body: JSON.stringify(upstream) });
      if (result.status >= 200 && result.status < 300) return { ok: true };
      const msg = String((result.body as any)?.errorMessage || 'Toggle failed');
      return { ok: false, error: msg };
    }

    if (action.type === 'set_timer') {
      // Interpret as: turn ON with provided timer (endDate or minutes)
      const upstream: any = { toggle: { status: 1 } };
      const timerISO = computeTimerISOFromPayload(action.payload || {});
      if (timerISO) upstream.toggle.timer = timerISO;
      const result = await acRemoteFetch('/prepaid/toggle-status', token, { method: 'POST', body: JSON.stringify(upstream) });
      if (result.status >= 200 && result.status < 300) return { ok: true };
      const msg = String((result.body as any)?.errorMessage || 'Set timer failed');
      return { ok: false, error: msg };
    }

    return { ok: false, error: `Unsupported action type: ${action.type}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}
