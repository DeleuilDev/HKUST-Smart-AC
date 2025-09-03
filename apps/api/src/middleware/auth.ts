import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  userId: string;
  name?: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfigured: missing JWT secret' });
    const payload = jwt.verify(token, secret) as AuthUser & jwt.JwtPayload;
    (req as any).user = { userId: payload.userId, name: payload.name } satisfies AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function signUserToken(user: AuthUser, expiresIn: string | number = '7d') {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret not configured');
  const payload: jwt.JwtPayload = { userId: user.userId, name: user.name } as any;
  return jwt.sign(payload, secret as jwt.Secret, { expiresIn } as jwt.SignOptions);
}
