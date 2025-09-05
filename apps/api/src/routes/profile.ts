import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const user = await db.getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, surname: (user as any).surname, lastname: (user as any).lastname, email: user.email, studentId: user.studentId, room: user.room, ext: user.ext, hallInfo: (user as any).hallInfo, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

router.put('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { firstName, lastName, surname, lastname, email, studentId, room, ext, hallInfo } = req.body || {};
  const user = await db.updateUser(userId, { firstName, lastName, email, studentId, room, ext, ...(surname !== undefined ? { surname } : {}), ...(lastname !== undefined ? { lastname } : {}), ...(hallInfo !== undefined ? { hallInfo } : {}) } as any);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, surname: (user as any).surname, lastname: (user as any).lastname, email: user.email, studentId: user.studentId, room: user.room, ext: user.ext, hallInfo: (user as any).hallInfo, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

export default router;
