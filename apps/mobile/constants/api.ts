export const AC_BASE_URL = process.env.EXPO_PUBLIC_AC_BASE_URL ?? 'https://w5.ab.ust.hk';
export const AC_APP_BASE = `${AC_BASE_URL}/njggt`;
export const AC_API_BASE = `${AC_APP_BASE}/api/app`;

// Endpoint that returns the bearer token JSON after CAS auth
export const AC_CAS_AUTH_ENDPOINT = `${AC_API_BASE}/auth/cas/auth`;
// A page that triggers CAS redirection when not authenticated
export const AC_APP_ENTRY_URL = process.env.EXPO_PUBLIC_AC_APP_ENTRY_URL ?? `${AC_APP_BASE}/app/login?path=/home`;

// Useful defaults for headers
export const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

