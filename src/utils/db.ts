import Dexie, { type Table } from 'dexie';
import type { LocalUser } from '../types';

// Local Dexie attendance shape — simpler than the server AttendanceLog
interface LocalAttendanceLog {
  id: string;
  userId: string;
  userName: string;
  type: string;
  confidence: number;
  method: string;
  timestamp: string;
}

export class FacialDatabase extends Dexie {
    users!: Table<LocalUser>;
    attendance!: Table<LocalAttendanceLog>;

    constructor() {
        super('FacialDB');
        this.version(1).stores({
            users: 'id, name, email, createdAt',
            attendance: 'id, userId, timestamp',
        });
    }
}

export const db = new FacialDatabase();
