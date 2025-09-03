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
  const res = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers as any),
    },
  });
  return res;
}

export async function backendAuthedFetch(path: string, options: BackendOptions = {}) {
  const auth = await getAuth();
  const token = auth?.server?.token;
  const url = /^https?:\/\//i.test(path) ? path : `${BACKEND_BASE}${path}`;
  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...(options.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  return res;
}

export type SessionResponse = {
  token: string;
  isNew?: boolean;
  user: {
    id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    studentId?: string;
    room?: string;
    ext?: string;
  };
};
