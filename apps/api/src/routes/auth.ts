import { Router } from 'express';
import { db } from '../db/database.js';
import { signUserToken } from '../middleware/auth.js';
import { extractUserFields } from '../util/extract.js';

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
  const name = deep.name.value || casPayload?.displayName || casPayload?.user?.name;
  const firstName = deep.firstName.value;
  const lastName = deep.lastName.value;
  const email = deep.email.value;
  const studentId = deep.studentId.value || casPayload?.user?.id;
  const room = deep.room.value;
  const ext = deep.ext.value;

  const { user, created } = db.upsertUser({ name, firstName, lastName, email, studentId, room, ext, casPayload, casToken: token });
  const jwt = signUserToken({ userId: user.id, name: user.name }, '7d');
  const response: any = { token: jwt, isNew: !!created, user: { id: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, email: user.email, studentId: user.studentId, room: user.room, ext: user.ext } };
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
});

export default router;
