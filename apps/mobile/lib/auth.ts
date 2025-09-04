import * as SecureStore from 'expo-secure-store';

const AUTH_KEY = 'hkust_ac_auth_v1';

export type AuthPayload = {
  // Bearer token used by the NJGGT API. Key name may vary; we'll store copy in token when detected.
  token?: string;
  // Epoch ms or ISO string if known
  expiresAt?: number | string;
  // Raw JSON returned by the CAS auth endpoint
  raw?: any;
  // Backend session (our API)
  server?: {
    token: string;
    isNew?: boolean;
    user: {
      id: string;
      // legacy
      firstName?: string;
      lastName?: string;
      // new
      surname?: string;
      lastname?: string;
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
};

export async function setAuth(payload: AuthPayload) {
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(payload));
}

export async function getAuth(): Promise<AuthPayload | null> {
  const raw = await SecureStore.getItemAsync(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(AUTH_KEY);
}

// Try to heuristically extract a bearer token from unknown JSON shapes
export function extractToken(obj: any): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;

  // Direct known paths
  const direct = [
    obj.token,
    obj.access_token,
    obj.jwt,
    obj.idToken,
    obj.bearer,
    obj?.data?.token,
    obj?.data?.access_token,
    obj?.data?.auth?.token,
    obj?.auth?.token,
  ];
  for (const c of direct) {
    if (typeof c === 'string' && c.length >= 6) return c; // allow short opaque tokens
  }

  // Shallow scan for plausible token strings
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.length >= 6 && /^(eyJ|[A-Za-z0-9-_]{6,})$/.test(v)) return v;
  }

  // Deep search by key name
  const keys = new Set(['token', 'access_token', 'bearer', 'jwt', 'idToken']);
  const stack: any[] = [obj];
  let depth = 0;
  while (stack.length && depth < 10) {
    const cur = stack.pop();
    depth++;
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur)) {
        if (keys.has(k) && typeof v === 'string' && v.length >= 6) return v;
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
  return undefined;
}
