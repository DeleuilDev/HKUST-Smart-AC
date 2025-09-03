type Found = { value?: string; path?: string };

function isStringLike(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalize(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function deepFindFirst(obj: any, matchers: RegExp[]): Found {
  const seen = new Set<any>();

  function visit(node: any, path: string[]): Found | undefined {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return; // prevent cycles
    seen.add(node);

    for (const [k, v] of Object.entries(node)) {
      const norm = normalize(k);
      if (isStringLike(v)) {
        if (matchers.some((re) => re.test(norm))) {
          return { value: v, path: [...path, k].join('.') };
        }
      }
    }

    for (const [k, v] of Object.entries(node)) {
      const child = visit(v, [...path, k]);
      if (child) return child;
    }
  }

  return visit(obj, []) || {};
}

export function extractUserFields(casPayload: any) {
  const res = {
    token: deepFindFirst(casPayload, [/token$/, /bearer/, /jwt/]),
    name: deepFindFirst(casPayload, [/^name$/, /displayname/, /^cn$/]),
    firstName: deepFindFirst(casPayload, [/^firstname$/, /givenname/, /^gn$/, /prenom/]),
    lastName: deepFindFirst(casPayload, [/^lastname$/, /familyname/, /^sn$/, /surname/, /nom/]),
    email: deepFindFirst(casPayload, [/^email$/, /^mail$/, /mailprimary/]),
    studentId: deepFindFirst(casPayload, [/^studentid$/, /^sid$/, /hkustid/, /^uid$/]),
    room: deepFindFirst(casPayload, [/^room$/, /roomnumber/, /chamber/, /dorm(room)?/, /roomno/]),
    ext: deepFindFirst(casPayload, [/^ext$/, /extension$/, /phoneext/, /telephoneextension/, /^telex$/]),
  } as const;
  return res;
}

