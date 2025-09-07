import crypto from 'crypto';
import type { ScheduledAction, User, WeeklySchedule, WeeklyMode, WeeklyHours, SmartModeConfig } from './types.js';
import { getSupabase } from '../lib/supabase.js';
import { extractUserFields } from '../util/extract.js';

function nowISO() {
  return new Date().toISOString();
}

function sha256String(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildHallInfoFromPayload(payload: any) {
  const student = (payload as any)?.data?.student || (payload as any)?.student || (payload as any)?.user?.student;
  if (!student) return undefined;
  return {
    bldg_cde: student?.bldg_cde,
    bldg_short_nam: student?.bldg_short_nam,
    bldg_apt_room_nbr: student?.bldg_apt_room_nbr,
    bldg_room_bed_nbr: student?.bldg_room_bed_nbr,
    bldg_floor_nbr: student?.bldg_floor_nbr,
    bldg_room_type_cde: student?.bldg_room_type_cde,
    bldg_room_res_type_ind: student?.bldg_room_res_type_ind,
  } as any;
}

async function fetchUserRowBy(params: { id?: string; studentId?: string; tokenHash?: string }) {
  const supabase = getSupabase();
  if (params.id) {
    const { data, error } = await supabase.from('users').select('*').eq('id', params.id).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (params.studentId) {
    const { data, error } = await supabase.from('users').select('*').eq('student_id', params.studentId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (params.tokenHash) {
    const { data, error } = await supabase.from('cas_tokens').select('user_id').eq('token_hash', params.tokenHash).maybeSingle();
    if (error) throw error;
    if (data?.user_id) {
      const { data: u, error: e2 } = await supabase.from('users').select('*').eq('id', data.user_id).maybeSingle();
      if (e2) throw e2;
      if (u) return u;
    }
  }
  return undefined;
}

async function latestCasPayload(userId: string): Promise<any | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cas_tokens')
    .select('payload')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.payload ?? undefined;
}

async function toUserShape(row: any): Promise<User> {
  const payload = row?.id ? await latestCasPayload(String(row.id)) : undefined;
  const deep = payload ? extractUserFields(payload) : undefined;
  const firstName = deep?.firstName?.value;
  const lastName = deep?.lastName?.value;
  const room = deep?.room?.value;
  const ext = deep?.ext?.value;

  const hallInfo = buildHallInfoFromPayload(payload);

  const user: User = {
    id: String(row.id),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    firstName,
    lastName,
    surname: row.surname ?? undefined,
    lastname: row.given_names ?? undefined,
    email: row.email ?? undefined,
    studentId: row.student_id ?? undefined,
    room: room ?? undefined,
    ext: ext ?? undefined,
    casTokenHash: undefined,
    casPayload: payload,
    hallInfo,
    sessionVersion: row.session_version ?? 0,
  };
  return user;
}

export const db = {
  // Users
  async upsertUser(
    params: Partial<User> & { id?: string; casToken?: string; casPayload?: any },
    opts?: { bumpSessionVersion?: boolean }
  ): Promise<{ user: User; created: boolean }> {
    const supabase = getSupabase();
    const payload = params.casPayload as any | undefined;
    const tokenFromPayload = payload ? extractUserFields(payload)?.token?.value : undefined;
    const tokenSource = params.casToken || tokenFromPayload;
    const tokenHash = tokenSource ? sha256String(tokenSource) : undefined;
    const studentId = params.studentId !== undefined && params.studentId !== null
      ? String(params.studentId).trim()
      : undefined;

    let row = await fetchUserRowBy({ id: params.id, studentId, tokenHash });
    let created = false;

    const surname = (params as any).surname as string | undefined;
    const givenNames = (params as any).lastname as string | undefined; // lastname carries given names in our app shape

    if (!row) {
      const insert = {
        email: params.email ?? null,
        student_id: studentId ?? null,
        surname: surname ?? null,
        given_names: givenNames ?? null,
        full_name: (surname && givenNames) ? `${surname}, ${givenNames}` : null,
        session_version: 1,
      };
      const { data, error } = await supabase.from('users').insert(insert).select('*').single();
      if (error) throw error;
      row = data;
      created = true;
    } else {
      const patch: any = { updated_at: nowISO() };
      if (params.email !== undefined) patch.email = params.email;
      if (studentId !== undefined) patch.student_id = studentId;
      if (surname !== undefined) patch.surname = surname;
      if (givenNames !== undefined) patch.given_names = givenNames;
      if (surname !== undefined || givenNames !== undefined) {
        patch.full_name = [surname, givenNames].filter(Boolean).join(', ') || null;
      }
      if (opts?.bumpSessionVersion) patch.session_version = Number(row.session_version || 0) + 1;
      if (Object.keys(patch).length > 1) {
        const { data, error } = await supabase.from('users').update(patch).eq('id', row.id).select('*').single();
        if (error) throw error;
        row = data;
      }
    }

    if (tokenHash) {
      const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const { error: e2 } = await supabase
        .from('cas_tokens')
        .upsert({
          user_id: row.id,
          token_hash: tokenHash,
          expires_at: expires,
          payload: payload ?? null,
        }, { onConflict: 'user_id' });
      if (e2) throw e2;
    }

    const user = await toUserShape(row);
    return { user, created };
  },

  async bumpSessionVersion(id: string): Promise<User | undefined> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update({ session_version: (await (async () => {
        const { data: r } = await supabase.from('users').select('session_version').eq('id', id).single();
        return Number(r?.session_version || 0) + 1;
      })()) })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return await toUserShape(data);
  },

  async getUser(id: string): Promise<User | undefined> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return await toUserShape(data);
  },

  async updateUser(id: string, patch: Partial<User>): Promise<User | undefined> {
    const supabase = getSupabase();
    const changes: any = { updated_at: nowISO() };
    if (patch.email !== undefined) changes.email = patch.email;
    if (patch.studentId !== undefined) changes.student_id = patch.studentId;
    if ((patch as any).surname !== undefined) changes.surname = (patch as any).surname;
    if ((patch as any).lastname !== undefined) changes.given_names = (patch as any).lastname;
    if (changes.surname !== undefined || changes.given_names !== undefined) {
      changes.full_name = [changes.surname, changes.given_names].filter(Boolean).join(', ') || null;
    }
    const { data, error } = await supabase.from('users').update(changes).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return await toUserShape(data);
  },

  // Scheduled actions
  async createScheduledAction(
    input: Omit<ScheduledAction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: ScheduledAction['status'] }
  ): Promise<ScheduledAction> {
    const supabase = getSupabase();
    const now = nowISO();
    const record = {
      user_id: input.userId,
      type: input.type,
      payload: input.payload ?? null,
      scheduled_at: input.scheduledAt,
      status: input.status ?? 'pending',
      created_at: now,
      updated_at: now,
    } as const;
    const { data, error } = await supabase.from('scheduled_actions').insert(record).select('*').single();
    if (error) throw error;
    return {
      id: String(data.id),
      userId: data.user_id,
      type: data.type,
      payload: data.payload ?? undefined,
      scheduledAt: new Date(data.scheduled_at).toISOString(),
      status: data.status,
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
      lastError: data.last_error ?? undefined,
      executedAt: data.executed_at ? new Date(data.executed_at).toISOString() : undefined,
    };
  },

  async listScheduledActionsByUser(userId: string): Promise<ScheduledAction[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scheduled_actions')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((d) => ({
      id: String(d.id), userId: d.user_id, type: d.type, payload: d.payload ?? undefined,
      scheduledAt: new Date(d.scheduled_at).toISOString(), status: d.status,
      createdAt: new Date(d.created_at).toISOString(), updatedAt: new Date(d.updated_at).toISOString(),
      lastError: d.last_error ?? undefined, executedAt: d.executed_at ? new Date(d.executed_at).toISOString() : undefined,
    }));
  },

  async listAllScheduledActions(): Promise<ScheduledAction[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scheduled_actions')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((d) => ({
      id: String(d.id), userId: d.user_id, type: d.type, payload: d.payload ?? undefined,
      scheduledAt: new Date(d.scheduled_at).toISOString(), status: d.status,
      createdAt: new Date(d.created_at).toISOString(), updatedAt: new Date(d.updated_at).toISOString(),
      lastError: d.last_error ?? undefined, executedAt: d.executed_at ? new Date(d.executed_at).toISOString() : undefined,
    }));
  },

  async listPendingActions(): Promise<ScheduledAction[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('scheduled_actions')
      .select('*')
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return (data || []).map((d) => ({
      id: String(d.id), userId: d.user_id, type: d.type, payload: d.payload ?? undefined,
      scheduledAt: new Date(d.scheduled_at).toISOString(), status: d.status,
      createdAt: new Date(d.created_at).toISOString(), updatedAt: new Date(d.updated_at).toISOString(),
      lastError: d.last_error ?? undefined, executedAt: d.executed_at ? new Date(d.executed_at).toISOString() : undefined,
    }));
  },

  async getScheduledAction(id: string): Promise<ScheduledAction | undefined> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('scheduled_actions').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: String(data.id), userId: data.user_id, type: data.type, payload: data.payload ?? undefined,
      scheduledAt: new Date(data.scheduled_at).toISOString(), status: data.status,
      createdAt: new Date(data.created_at).toISOString(), updatedAt: new Date(data.updated_at).toISOString(),
      lastError: data.last_error ?? undefined, executedAt: data.executed_at ? new Date(data.executed_at).toISOString() : undefined,
    };
  },

  async updateScheduledAction(id: string, patch: Partial<ScheduledAction>): Promise<ScheduledAction | undefined> {
    const supabase = getSupabase();
    const changes: any = { updated_at: nowISO() };
    if (patch.status !== undefined) changes.status = patch.status;
    if (patch.payload !== undefined) changes.payload = patch.payload;
    if (patch.executedAt !== undefined) changes.executed_at = patch.executedAt;
    if (patch.lastError !== undefined) changes.last_error = patch.lastError;
    if (patch.scheduledAt !== undefined) changes.scheduled_at = patch.scheduledAt;
    const { data, error } = await supabase
      .from('scheduled_actions')
      .update(changes)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: String(data.id), userId: data.user_id, type: data.type, payload: data.payload ?? undefined,
      scheduledAt: new Date(data.scheduled_at).toISOString(), status: data.status,
      createdAt: new Date(data.created_at).toISOString(), updatedAt: new Date(data.updated_at).toISOString(),
      lastError: data.last_error ?? undefined, executedAt: data.executed_at ? new Date(data.executed_at).toISOString() : undefined,
    };
  },

  // Weekly schedules (persistent, applied automatically)
  async getWeeklyScheduleByUser(userId: string): Promise<WeeklySchedule | undefined> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('weekly_schedules')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const base: WeeklySchedule = {
      id: String(data.id),
      userId: data.user_id,
      mode: (data.mode ?? 'on') as WeeklyMode,
      slots: Array.isArray(data.slots) ? (data.slots as any[]).map(Boolean) : [],
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
    };
    try { base.hours = slotsToHours(base.slots); } catch {}
    return base;
  },

  async upsertWeeklySchedule(userId: string, input: { mode: WeeklyMode; slots: boolean[] }): Promise<WeeklySchedule> {
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('weekly_schedules')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    const record = {
      user_id: userId,
      mode: input.mode,
      slots: input.slots,
      updated_at: nowISO(),
    } as any;
    if (!existing) record.created_at = nowISO();
    const q = existing
      ? supabase.from('weekly_schedules').update(record).eq('id', existing.id).select('*').single()
      : supabase.from('weekly_schedules').insert(record).select('*').single();
    const { data, error } = await q;
    if (error) throw error;
    const out: WeeklySchedule = {
      id: String(data.id),
      userId: data.user_id,
      mode: (data.mode ?? 'on') as WeeklyMode,
      slots: Array.isArray(data.slots) ? (data.slots as any[]).map(Boolean) : [],
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
    };
    try { out.hours = slotsToHours(out.slots); } catch {}
    return out;
  },

  async listAllWeeklySchedules(): Promise<WeeklySchedule[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('weekly_schedules').select('*');
    if (error) throw error;
    return (data || []).map((d) => {
      const slots = Array.isArray(d.slots) ? (d.slots as any[]).map(Boolean) : [];
      const obj: WeeklySchedule = {
        id: String(d.id),
        userId: d.user_id,
        mode: (d.mode ?? 'on') as WeeklyMode,
        slots,
        createdAt: new Date(d.created_at).toISOString(),
        updatedAt: new Date(d.updated_at).toISOString(),
      };
      try { obj.hours = slotsToHours(slots); } catch {}
      return obj;
    });
  },

  // Smart Mode
  async getSmartModeByUser(userId: string): Promise<SmartModeConfig | undefined> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('smart_modes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: String(data.id),
      userId: data.user_id,
      runMinutes: data.run_minutes,
      pauseMinutes: data.pause_minutes,
      totalMinutes: data.total_minutes ?? undefined,
      startAt: data.start_at ? new Date(data.start_at).toISOString() : undefined,
      active: Boolean(data.active),
      remainingMinutes: data.remaining_minutes ?? undefined,
      phase: data.phase ?? undefined,
      nextAt: data.next_at ? new Date(data.next_at).toISOString() : undefined,
      startedAt: data.started_at ? new Date(data.started_at).toISOString() : undefined,
      endsAt: data.ends_at ? new Date(data.ends_at).toISOString() : undefined,
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
    };
  },

  async upsertSmartMode(userId: string, input: {
    runMinutes: number; pauseMinutes: number; totalMinutes?: number; startAt?: string | null; active?: boolean;
  }): Promise<SmartModeConfig> {
    const supabase = getSupabase();
    const now = nowISO();
    const existing = await this.getSmartModeByUser(userId);
    const record: any = {
      user_id: userId,
      run_minutes: Math.trunc(input.runMinutes),
      pause_minutes: Math.trunc(input.pauseMinutes),
      total_minutes: input.totalMinutes != null ? Math.trunc(input.totalMinutes) : null,
      start_at: input.startAt ?? null,
      active: input.active ?? true,
      updated_at: now,
    };
    if (!existing) record.created_at = now;
    if (record.total_minutes != null) record.remaining_minutes = record.total_minutes; else record.remaining_minutes = null;
    const q = existing
      ? supabase.from('smart_modes').update(record).eq('id', existing.id).select('*').single()
      : supabase.from('smart_modes').insert(record).select('*').single();
    const { data, error } = await q;
    if (error) throw error;
    return {
      id: String(data.id), userId: data.user_id,
      runMinutes: data.run_minutes, pauseMinutes: data.pause_minutes,
      totalMinutes: data.total_minutes ?? undefined,
      startAt: data.start_at ? new Date(data.start_at).toISOString() : undefined,
      active: Boolean(data.active),
      remainingMinutes: data.remaining_minutes ?? undefined,
      phase: data.phase ?? undefined,
      nextAt: data.next_at ? new Date(data.next_at).toISOString() : undefined,
      startedAt: data.started_at ? new Date(data.started_at).toISOString() : undefined,
      endsAt: data.ends_at ? new Date(data.ends_at).toISOString() : undefined,
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
    };
  },

  async updateSmartMode(userId: string, patch: Partial<SmartModeConfig>): Promise<SmartModeConfig | undefined> {
    const supabase = getSupabase();
    const existing = await this.getSmartModeByUser(userId);
    if (!existing) return undefined;
    const changes: any = { updated_at: nowISO() };
    if (patch.runMinutes != null) changes.run_minutes = Math.trunc(patch.runMinutes);
    if (patch.pauseMinutes != null) changes.pause_minutes = Math.trunc(patch.pauseMinutes);
    if (patch.totalMinutes !== undefined) changes.total_minutes = patch.totalMinutes != null ? Math.trunc(patch.totalMinutes) : null;
    if (patch.startAt !== undefined) changes.start_at = patch.startAt ?? null;
    if (patch.active !== undefined) changes.active = patch.active;
    if (patch.remainingMinutes !== undefined) changes.remaining_minutes = patch.remainingMinutes;
    if (patch.phase !== undefined) changes.phase = patch.phase;
    if (patch.nextAt !== undefined) changes.next_at = patch.nextAt;
    if (patch.startedAt !== undefined) changes.started_at = patch.startedAt;
    if (patch.endsAt !== undefined) changes.ends_at = patch.endsAt;
    const { data, error } = await supabase
      .from('smart_modes')
      .update(changes)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: String(data.id), userId: data.user_id,
      runMinutes: data.run_minutes, pauseMinutes: data.pause_minutes,
      totalMinutes: data.total_minutes ?? undefined,
      startAt: data.start_at ? new Date(data.start_at).toISOString() : undefined,
      active: Boolean(data.active),
      remainingMinutes: data.remaining_minutes ?? undefined,
      phase: data.phase ?? undefined,
      nextAt: data.next_at ? new Date(data.next_at).toISOString() : undefined,
      startedAt: data.started_at ? new Date(data.started_at).toISOString() : undefined,
      endsAt: data.ends_at ? new Date(data.ends_at).toISOString() : undefined,
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
    };
  },

  async listActiveSmartModes(): Promise<SmartModeConfig[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('smart_modes')
      .select('*')
      .eq('active', true);
    if (error) throw error;
    return (data || []).map((d) => ({
      id: String(d.id), userId: d.user_id,
      runMinutes: d.run_minutes, pauseMinutes: d.pause_minutes,
      totalMinutes: d.total_minutes ?? undefined,
      startAt: d.start_at ? new Date(d.start_at).toISOString() : undefined,
      active: Boolean(d.active),
      remainingMinutes: d.remaining_minutes ?? undefined,
      phase: d.phase ?? undefined,
      nextAt: d.next_at ? new Date(d.next_at).toISOString() : undefined,
      startedAt: d.started_at ? new Date(d.started_at).toISOString() : undefined,
      endsAt: d.ends_at ? new Date(d.ends_at).toISOString() : undefined,
      createdAt: new Date(d.created_at).toISOString(),
      updatedAt: new Date(d.updated_at).toISOString(),
    }));
  },
};

export function sha256(input?: string) {
  if (!input) return undefined;
  return sha256String(input);
}

function slotsToHours(slots: boolean[]): WeeklyHours {
  const ensure = (arr: number[]) => Array.from(new Set(arr)).sort((a, b) => a - b);
  const dayHours = (dayIndexMon0: number) => {
    const sun0 = (dayIndexMon0 + 1) % 7; // convert to sunday-first index in slots
    const base = sun0 * 24;
    const hours: number[] = [];
    for (let h = 0; h < 24; h++) if (slots[base + h]) hours.push(h);
    return ensure(hours);
  };
  return {
    mon: dayHours(0),
    tue: dayHours(1),
    wed: dayHours(2),
    thu: dayHours(3),
    fri: dayHours(4),
    sat: dayHours(5),
    sun: dayHours(6),
  };
}
