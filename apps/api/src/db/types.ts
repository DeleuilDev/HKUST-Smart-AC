export type ISODateString = string;

export interface User {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  studentId?: string; // Primary unique key for user matching when available
  room?: string;
  ext?: string;
  casTokenHash?: string; // hash of external token if provided
  casPayload?: unknown; // raw payload for debugging/auditing
}

export type ActionType = 'power_on' | 'power_off' | 'set_timer';

export interface ScheduledAction {
  id: string;
  userId: string;
  type: ActionType;
  payload?: Record<string, unknown>;
  scheduledAt: ISODateString; // when to run
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastError?: string;
  executedAt?: ISODateString;
}

export interface DatabaseShape {
  users: User[];
  scheduledActions: ScheduledAction[];
  _meta: { version: number };
}
