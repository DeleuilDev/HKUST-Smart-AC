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
