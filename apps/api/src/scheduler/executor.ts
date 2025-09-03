import type { ScheduledAction } from '../db/types.js';

// Stub for school AC API client. Replace with real HTTPS calls.
async function callSchoolACAPI(action: ScheduledAction): Promise<void> {
  // TODO: integrate with real school API using stored CAS token when available
  // For now, simulate success.
  await new Promise((r) => setTimeout(r, 100));
  console.log(`[executor] Simulated execution of ${action.type} with payload`, action.payload);
}

export async function executeAction(action: ScheduledAction): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await callSchoolACAPI(action);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

