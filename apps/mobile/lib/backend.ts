import { DEFAULT_HEADERS } from '@/constants/api';
import { Platform } from 'react-native';
import { getAuth } from '@/lib/auth';

function resolveBackendBase() {
  let base = process.env.EXPO_PUBLIC_BACKEND_BASE_URL ?? 'http://localhost:3000';
  if (Platform.OS === 'android') {
    // Android emulator cannot reach host via localhost; use 10.0.2.2
    base = base.replace('http://localhost', 'http://10.0.2.2').replace('http://127.0.0.1', 'http://10.0.2.2');
  }
  return base;
}

const BACKEND_BASE = resolveBackendBase();

export type BackendOptions = RequestInit;

export async function backendFetch(path: string, options: BackendOptions = {}) {
  const url = /^https?:\/\//i.test(path) ? path : `${BACKEND_BASE}${path}`;
  const method = String(options.method || 'GET').toUpperCase();
  const hasBody = options.body != null && method !== 'GET' && method !== 'HEAD';
  const mergedHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as any),
  };
  // Set Content-Type only when sending a body
  if (hasBody) {
    if (!('Content-Type' in mergedHeaders)) mergedHeaders['Content-Type'] = 'application/json';
  } else {
    // Ensure we don't send Content-Type on GET/HEAD to avoid strict proxies/WAFs quirks
    if ('Content-Type' in mergedHeaders) delete (mergedHeaders as any)['Content-Type'];
  }
  const res = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
  return res;
}

export async function backendAuthedFetch(path: string, options: BackendOptions = {}) {
  const auth = await getAuth();
  const token = auth?.server?.token;
  const url = /^https?:\/\//i.test(path) ? path : `${BACKEND_BASE}${path}`;
  const method = String(options.method || 'GET').toUpperCase();
  const hasBody = options.body != null && method !== 'GET' && method !== 'HEAD';
  const mergedHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as any),
  };
  if (hasBody) {
    if (!('Content-Type' in mergedHeaders)) mergedHeaders['Content-Type'] = 'application/json';
  } else {
    if ('Content-Type' in mergedHeaders) delete (mergedHeaders as any)['Content-Type'];
  }
  if (token) mergedHeaders.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers: mergedHeaders });
  return res;
}

export type SessionResponse = {
  token: string;
  isNew?: boolean;
  user: {
    id: string;
    // legacy
    firstName?: string;
    lastName?: string;
    // new fields
    surname?: string;  // famille
    lastname?: string; // prénoms
    email?: string;
    studentId?: string;
    room?: string;
    ext?: string;
    hallInfo?: {
      bldg_cde?: string;
      bldg_short_nam?: string;
      bldg_apt_room_nbr?: string;
      bldg_room_bed_nbr?: string;
      bldg_floor_nbr?: string;
      bldg_room_type_cde?: string;
      bldg_room_res_type_ind?: string;
    };
  };
};
