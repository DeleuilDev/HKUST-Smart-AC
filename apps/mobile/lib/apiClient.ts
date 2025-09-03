import { AC_API_BASE, DEFAULT_HEADERS } from '@/constants/api';
import { getAuth } from '@/lib/auth';

export type ApiOptions = RequestInit & { absolute?: boolean };

export async function apiFetch(path: string, options: ApiOptions = {}) {
  const { absolute, headers, ...rest } = options;
  const url = absolute || /^https?:\/\//i.test(path) ? path : `${AC_API_BASE}${path}`;

  const auth = await getAuth();
  const mergedHeaders: HeadersInit = {
    ...DEFAULT_HEADERS,
    ...(headers as any),
  };
  if (auth?.token) {
    (mergedHeaders as Record<string, string>).Authorization = `Bearer ${auth.token}`;
  }

  const res = await fetch(url, { ...rest, headers: mergedHeaders });
  return res;
}

