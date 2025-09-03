import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
import type { DatabaseShape, ScheduledAction, User } from './types.js';

const DATA_DIR = resolve(process.cwd(), 'data');
const DB_FILE = resolve(DATA_DIR, 'db.json');

function nowISO() {
  return new Date().toISOString();
}

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    const initial: DatabaseShape = { users: [], scheduledActions: [], _meta: { version: 1 } };
    writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
}

function readDb(): DatabaseShape {
  ensure();
  const raw = readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw) as DatabaseShape;
}

function writeDb(db: DatabaseShape) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export const db = {
  // Users
  upsertUser(params: Partial<User> & { id?: string; casToken?: string }): { user: User; created: boolean } {
    const database = readDb();
    const tokenHash = params.casToken ? sha256(params.casToken) : undefined;
    const studentId = params.studentId !== undefined && params.studentId !== null
      ? String(params.studentId).trim()
      : undefined;
    const now = nowISO();

    let user: User | undefined;
    if (params.id) user = database.users.find((u) => u.id === params.id);
    // Prefer matching by studentId if provided
    if (!user && studentId) user = database.users.find((u) => (u.studentId || '').trim() === studentId);
    // Fallback to token hash matching
    if (!user && tokenHash) user = database.users.find((u) => u.casTokenHash === tokenHash);

    let created = false;
    if (!user) {
      user = {
        id: params.id || id('usr'),
        createdAt: now,
        updatedAt: now,
        name: params.name,
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        studentId,
        room: params.room,
        ext: params.ext,
        casTokenHash: tokenHash,
        casPayload: params.casPayload,
      };
      database.users.push(user);
      created = true;
    } else {
      user.updatedAt = now;
      if (params.name !== undefined) user.name = params.name;
      if (params.email !== undefined) user.email = params.email;
      if (studentId !== undefined) user.studentId = studentId;
      if (params.firstName !== undefined) user.firstName = params.firstName;
      if (params.lastName !== undefined) user.lastName = params.lastName;
      if (params.room !== undefined) user.room = params.room;
      if (params.ext !== undefined) user.ext = params.ext;
      if (tokenHash) user.casTokenHash = tokenHash;
      if (params.casPayload !== undefined) user.casPayload = params.casPayload;
    }

    writeDb(database);
    return { user, created };
  },

  getUser(id: string): User | undefined {
    return readDb().users.find((u) => u.id === id);
  },

  updateUser(id: string, patch: Partial<User>): User | undefined {
    const database = readDb();
    const user = database.users.find((u) => u.id === id);
    if (!user) return undefined;
    Object.assign(user, patch, { updatedAt: nowISO() });
    writeDb(database);
    return user;
  },

  // Scheduled actions
  createScheduledAction(input: Omit<ScheduledAction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: ScheduledAction['status'] }): ScheduledAction {
    const database = readDb();
    const now = nowISO();
    const action: ScheduledAction = {
      ...input,
      id: id('act'),
      createdAt: now,
      updatedAt: now,
      status: input.status ?? 'pending',
    };
    database.scheduledActions.push(action);
    writeDb(database);
    return action;
  },

  listScheduledActionsByUser(userId: string): ScheduledAction[] {
    const database = readDb();
    return database.scheduledActions.filter((a) => a.userId === userId);
  },

  listAllScheduledActions(): ScheduledAction[] {
    const database = readDb();
    return database.scheduledActions.slice();
  },

  listPendingActions(): ScheduledAction[] {
    const database = readDb();
    return database.scheduledActions.filter((a) => a.status === 'pending');
  },

  getScheduledAction(id: string): ScheduledAction | undefined {
    const database = readDb();
    return database.scheduledActions.find((a) => a.id === id);
  },

  updateScheduledAction(id: string, patch: Partial<ScheduledAction>): ScheduledAction | undefined {
    const database = readDb();
    const action = database.scheduledActions.find((a) => a.id === id);
    if (!action) return undefined;
    Object.assign(action, patch, { updatedAt: nowISO() });
    writeDb(database);
    return action;
  },
};

export function sha256(input?: string) {
  if (!input) return undefined;
  return crypto.createHash('sha256').update(input).digest('hex');
}
