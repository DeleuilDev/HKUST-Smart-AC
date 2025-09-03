import 'dotenv/config';
import express from 'express';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import scheduleRoutes from './routes/schedule.js';
import acRoutes from './routes/ac.js';
import { scheduler } from './scheduler/scheduler.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/me', requireAuth, (req, res) => {
  res.json({ user: (req as any).user });
});

app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/schedule', scheduleRoutes);
app.use('/ac', acRoutes);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
  scheduler.start();
});
