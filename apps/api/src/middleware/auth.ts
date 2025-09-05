import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/database.js';

export interface AuthUser {
  userId: string;
  v?: number; // sessionVersion embedded in JWT
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfigured: missing JWT secret' });
    const payload = jwt.verify(token, secret) as AuthUser & jwt.JwtPayload;
    const user = await db.getUser(payload.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const currentV = user.sessionVersion || 0;
    const tokenV = typeof payload.v === 'number' ? payload.v : 0;
    if (tokenV !== currentV) return res.status(401).json({ error: 'Session invalidated' });
    (req as any).user = { userId: payload.userId } satisfies AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function signUserToken(user: { userId: string }, expiresIn: string | number = '7d') {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret not configured');
  const u = await db.getUser(user.userId);
  const v = u?.sessionVersion || 0;
  const payload: jwt.JwtPayload = { userId: user.userId, v } as any;
  return jwt.sign(payload, secret as jwt.Secret, { expiresIn } as jwt.SignOptions);
}
