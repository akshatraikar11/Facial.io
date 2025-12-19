import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  descriptor?: number[];
  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  name: string;
  date: string;
  time: string;
  status: string;
  timestamp: string;
}

interface Database {
  users: User[];
  attendance: AttendanceLog[];
}

const getDbPath = () => {
  const dbPath = config.dbPath;
  const dbDir = path.dirname(dbPath);
  return { dbPath, dbDir };
};

const ensureDbExists = async (): Promise<void> => {
  const { dbPath, dbDir } = getDbPath();

  try {
    await fs.access(dbDir);
  } catch {
    await fs.mkdir(dbDir, { recursive: true });
  }

  try {
    await fs.access(dbPath);
  } catch {
    const initialDb: Database = { users: [], attendance: [] };
    await fs.writeFile(dbPath, JSON.stringify(initialDb, null, 2), 'utf-8');
  }
};

const readDb = async (): Promise<Database> => {
  await ensureDbExists();
  const { dbPath } = getDbPath();
  const data = await fs.readFile(dbPath, 'utf-8');
  return JSON.parse(data);
};

const writeDb = async (data: Database): Promise<void> => {
  await ensureDbExists();
  const { dbPath } = getDbPath();
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
};

// User operations
export const db = {
  // Users
  async getUsers(): Promise<User[]> {
    const db = await readDb();
    return db.users;
  },

  async getUserById(id: string): Promise<User | null> {
    const db = await readDb();
    return db.users.find(u => u.id === id) || null;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const db = await readDb();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async createUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const db = await readDb();
    const newUser: User = {
      ...user,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    await writeDb(db);
    return newUser;
  },

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const db = await readDb();
    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex === -1) return null;

    db.users[userIndex] = {
      ...db.users[userIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await writeDb(db);
    return db.users[userIndex];
  },

  async deleteUser(id: string): Promise<boolean> {
    const db = await readDb();
    const initialLength = db.users.length;
    db.users = db.users.filter(u => u.id !== id);
    await writeDb(db);
    return db.users.length < initialLength;
  },

  // Attendance
  async getAttendance(filters?: { userId?: string; date?: string; startDate?: string; endDate?: string }): Promise<AttendanceLog[]> {
    const db = await readDb();
    let logs = db.attendance;

    if (filters?.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters?.date) {
      logs = logs.filter(l => l.date === filters.date);
    }
    if (filters?.startDate) {
      logs = logs.filter(l => l.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      logs = logs.filter(l => l.date <= filters.endDate!);
    }

    return logs;
  },

  async createAttendance(log: Omit<AttendanceLog, 'id' | 'timestamp'>): Promise<AttendanceLog> {
    const db = await readDb();
    const newLog: AttendanceLog = {
      ...log,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    db.attendance.push(newLog);
    await writeDb(db);
    return newLog;
  },

  async deleteAttendance(id: string): Promise<boolean> {
    const db = await readDb();
    const initialLength = db.attendance.length;
    db.attendance = db.attendance.filter(l => l.id !== id);
    await writeDb(db);
    return db.attendance.length < initialLength;
  },

  async clearAttendance(): Promise<void> {
    const db = await readDb();
    db.attendance = [];
    await writeDb(db);
  },
};
