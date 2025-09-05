import { Router } from 'express';
import { db } from '../db/database.js';
import { signUserToken, requireAuth } from '../middleware/auth.js';
import { extractUserFields } from '../util/extract.js';
import { acRemoteFetch } from '../util/acProxy.js';

const router = Router();

// Heuristic extraction of a bearer token from an unknown JSON shape
function extractToken(obj: any): string | undefined {
  const candidates = [
    obj?.token,
    obj?.access_token,
    obj?.data?.token,
    obj?.data?.access_token,
    obj?.data?.auth?.token,
    obj?.auth?.token,
  ];
  for (const c of candidates) if (typeof c === 'string' && c.length >= 6) return c;
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.length >= 6 && /token|bearer|jwt/i.test(k)) return v;
    }
  }
  return undefined;
}

router.post('/session', (req, res) => {
  const { casPayload } = req.body || {};
  if (!casPayload || typeof casPayload !== 'object') return res.status(400).json({ error: 'casPayload required' });

  // Prefer deep, robust extraction for all fields
  const deep = extractUserFields(casPayload);
  const token = deep.token.value || extractToken(casPayload);
  const rawName = deep.name.value || casPayload?.displayName || casPayload?.user?.name;
  const firstName = deep.firstName.value;
  const lastName = deep.lastName.value;
  const email = deep.email.value;
  const studentId = deep.studentId.value || casPayload?.user?.id;
  const room = deep.room.value;
  const ext = deep.ext.value;

  // New fields: surname/lastname parsed from a comma-separated name like "DELEUIL, Marius ..."
  let surname: string | undefined;
  let lastname: string | undefined;
  if (typeof rawName === 'string' && rawName.includes(',')) {
    const parts = rawName.split(',');
    surname = String(parts[0] || '').trim();
    lastname = String(parts.slice(1).join(',') || '').trim();
  }
  // Fallbacks from explicit fields when not comma-separated
  if (!surname && lastName) surname = lastName;
  if (!lastname && firstName) lastname = firstName;

  // Extract hall information snapshot from payload (best-effort)
  const student = (casPayload as any)?.data?.student || (casPayload as any)?.student || (casPayload as any)?.user?.student;
  const hallInfo = student ? {
    bldg_cde: student?.bldg_cde,
    bldg_short_nam: student?.bldg_short_nam,
    bldg_apt_room_nbr: student?.bldg_apt_room_nbr,
    bldg_room_bed_nbr: student?.bldg_room_bed_nbr,
    bldg_floor_nbr: student?.bldg_floor_nbr,
    bldg_room_type_cde: student?.bldg_room_type_cde,
    bldg_room_res_type_ind: student?.bldg_room_res_type_ind,
  } : undefined;
  // Require a CAS token to proceed
  if (!token || typeof token !== 'string' || token.length < 6) {
    return res.status(400).json({ errorMessage: 'Missing or invalid CAS token in payload' });
  }

  // Quick verification against the school API to ensure the user/token is valid
  // We use a lightweight endpoint (ac-status). On failure, bubble up the normalized error.
  // Note: this is synchronous in the handler; consider caching if needed.
  // Using top-level async isn't available here; wrap in an IIFE.
  (async () => {
    const verify = await acRemoteFetch('/prepaid/ac-status', token, { method: 'GET' });
    if (!(verify.status >= 200 && verify.status < 300)) {
      return res.status(verify.status).json(verify.body);
    }

    // Proceed to upsert only after successful verification
    const { user, created } = await db.upsertUser({ firstName, lastName, surname, lastname, email, studentId, room, ext, hallInfo, casPayload, casToken: token }, { bumpSessionVersion: true });
    const jwt = await signUserToken({ userId: user.id }, '7d');
    const response: any = {
      token: jwt,
      isNew: !!created,
      user: {
        id: user.id,
        // legacy compatibility
        firstName: user.firstName,
        lastName: user.lastName,
        // new fields
        surname: (user as any).surname,
        lastname: (user as any).lastname,
        email: user.email,
        studentId: user.studentId,
        room: user.room,
        ext: user.ext,
        hallInfo: (user as any).hallInfo,
      }
    };
    if (String(req.query.debug || '') === '1') {
      response.debug = {
        extracted: {
          name: deep.name,
          firstName: deep.firstName,
          lastName: deep.lastName,
          email: deep.email,
          studentId: deep.studentId,
          room: deep.room,
          ext: deep.ext,
          token: deep.token,
        },
      };
    }
    res.json(response);
  })().catch((e) => {
    res.status(500).json({ errorMessage: 'Session verification failed', detail: String(e?.message || e) });
  });
});

// Lightweight token validation + user info
router.get('/me', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const user = await db.getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    ok: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      surname: (user as any).surname,
      lastname: (user as any).lastname,
      email: user.email,
      studentId: user.studentId,
      room: user.room,
      ext: user.ext,
      hallInfo: (user as any).hallInfo,
    },
    serverTime: new Date().toISOString(),
  });
});

export default router;
