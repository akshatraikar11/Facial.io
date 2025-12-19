import Dexie, { type Table } from 'dexie';
import type { User, AttendanceLog } from '../types';

export class FacialDatabase extends Dexie {
    users!: Table<User>;
    attendance!: Table<AttendanceLog>;

    constructor() {
        super('FacialDB');
        this.version(1).stores({
            users: 'id, name, email, createdAt', // Primary key and indexed props
            attendance: 'id, userId, date, timestamp'
        });
    }
}

export const db = new FacialDatabase();
