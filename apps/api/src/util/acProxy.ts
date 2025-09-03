import { extractUserFields } from './extract.js';
// Lightweight helpers to call the school AC API and normalize responses
// so the mobile app sees consistent shapes and HTTP codes.

export type ProxyResult = { status: number; body: any };

/**
 * Pull a bearer token from an arbitrary CAS payload using deep heuristics.
 */
export function getCasTokenFromPayload(payload: any): string | undefined {
  try {
    const deep = extractUserFields(payload);
    return deep.token.value;
  } catch {
    return undefined;
  }
}

// Base URL for the upstream AC API (configurable for dev/prod)
const REMOTE_BASE = process.env.EXTERNAL_AC_API_BASE || 'https://w5.ab.ust.hk/njggt/api/app';

function joinUrl(base: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Call the upstream AC API with Authorization and return a normalized result.
 */
export async function acRemoteFetch(path: string, token: string, init?: RequestInit): Promise<ProxyResult> {
  const url = joinUrl(REMOTE_BASE, path);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
  try {
    const res = await fetch(url, { ...init, headers });
    const text = await res.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep as text
    }
    return normalizeRemoteResponse(res.status, body);
  } catch (e: any) {
    return { status: 502, body: { ok: false, error: e?.message || 'Upstream fetch failed' } };
  }
}

function toInt(n: unknown): number | undefined {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.trunc(n);
  if (typeof n === 'string') {
    const m = n.match(/^-?\d+/);
    if (m) return Math.trunc(Number(m[0]));
  }
  return undefined;
}

// Convert meta.code values like 4033 → 403 so we can use them as HTTP status.
function coerceMetaCodeToHttp(code: unknown): { http?: number; original?: number } {
  let val = toInt(code);
  const original = val;
  if (val === undefined) return { http: undefined, original };
  // If it's already a standard HTTP code
  if (val >= 100 && val <= 599) return { http: val, original };
  // If it's like 4033 or 2000, strip trailing digits until 3-digit
  while (val >= 1000) val = Math.trunc(val / 10);
  if (val >= 100 && val <= 599) return { http: val, original };
  return { http: undefined, original };
}

/**
 * Map upstream { meta: { code, message } } into HTTP status + simplified body.
 * - Success (2xx): return data only.
 * - Error: return { errorMessage } and remap common auth failures to 401.
 */
export function normalizeRemoteResponse(remoteStatus: number, payload: any): ProxyResult {
  // Upstream often returns HTTP 200 with a meta.code indicating error.
  const meta = payload && typeof payload === 'object' ? (payload.meta as any) : undefined;
  const { http: metaHttp, original: metaOriginal } = coerceMetaCodeToHttp(meta?.code);
  const message = typeof meta?.message === 'string' ? meta.message : undefined;

  let status = metaHttp ?? remoteStatus;
  // Map common auth failures to 401 regardless of upstream code (e.g., 4032)
  const lowerMsg = (message || '').toLowerCase();
  if (
    lowerMsg.includes('invalid bearer token') ||
    lowerMsg.includes('invalid token') ||
    lowerMsg.includes('token expired') ||
    lowerMsg.includes('expired token') ||
    lowerMsg.includes('unauthorized') ||
    metaOriginal === 401 || metaOriginal === 4010 || metaOriginal === 4011 || metaOriginal === 4032
  ) {
    status = 401;
  }

  // Success if status is 2xx
  const success = status >= 200 && status < 300;
  if (success) {
    // Return only the useful data payload; drop wrappers
    return { status, body: payload?.data ?? payload };
  } else {
    // Return only errorMessage for errors (no ok/meta/code)
    return { status, body: { errorMessage: message || 'Request failed' } };
  }
}

// Strict parse: only accept { action: 'on'|'off' }
/**
 * Strict power parser: only accepts { action: 'on'|'off' } → 1|0.
 */
export function parsePowerStatus(input: any): 0 | 1 | undefined {
  const action = typeof input?.action === 'string' ? input.action.trim().toLowerCase() : '';
  if (action === 'on') return 1;
  if (action === 'off') return 0;
  return undefined;
}
