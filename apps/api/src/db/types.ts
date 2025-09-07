export type ISODateString = string;

export interface User {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Legacy fields kept for compatibility with older clients
  firstName?: string;
  lastName?: string;
  // New fields per request
  surname?: string;  // famille (e.g., 'DELEUIL')
  lastname?: string; // prénoms (e.g., 'Marius Valentin Alexandre')
  email?: string;
  studentId?: string; // Primary unique key for user matching when available
  room?: string;
  ext?: string;
  casTokenHash?: string; // hash of external token if provided
  casPayload?: unknown; // raw payload for debugging/auditing
  // Hall information snapshot extracted from CAS payload
  hallInfo?: {
    bldg_cde?: string;
    bldg_short_nam?: string;
    bldg_apt_room_nbr?: string;
    bldg_room_bed_nbr?: string;
    bldg_floor_nbr?: string;
    bldg_room_type_cde?: string;
    bldg_room_res_type_ind?: string;
  };
  // Stored AC token (opaque) for backend usage
  acToken?: {
    value: string;
    updatedAt: ISODateString;
  };
  // Token invalidation: increment to revoke previous backend JWTs
  sessionVersion?: number;
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

export type WeeklyMode = 'on' | 'off';
export type WeeklyHours = {
  mon: number[];
  tue: number[];
  wed: number[];
  thu: number[];
  fri: number[];
  sat: number[];
  sun: number[];
};

export interface WeeklySchedule {
  id: string;
  userId: string;
  mode: WeeklyMode; // 'on' means selected slots turn AC ON; 'off' means selected slots turn AC OFF
  slots: boolean[]; // length 168 (7 days * 24 hours)
  // Derived mapping for readability (not necessarily persisted): hours active per day (0..23)
  hours?: WeeklyHours;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SmartModeConfig {
  id: string;
  userId: string;
  runMinutes: number;
  pauseMinutes: number;
  totalMinutes?: number; // optional: run until manually stopped
  startAt?: ISODateString; // optional delayed start
  active: boolean;
  remainingMinutes?: number; // counts down when totalMinutes set
  phase?: 'idle' | 'running' | 'paused';
  nextAt?: ISODateString;
  startedAt?: ISODateString;
  endsAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
