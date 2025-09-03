import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const user = db.getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, email: user.email, studentId: user.studentId, room: user.room, ext: user.ext, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

router.put('/', requireAuth, (req, res) => {
  const { userId } = (req as any).user as { userId: string };
  const { name, firstName, lastName, email, studentId, room, ext } = req.body || {};
  const user = db.updateUser(userId, { name, firstName, lastName, email, studentId, room, ext });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, email: user.email, studentId: user.studentId, room: user.room, ext: user.ext, createdAt: user.createdAt, updatedAt: user.updatedAt });
});

export default router;
