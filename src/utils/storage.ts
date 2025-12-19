import { db } from './db';
import type { User, AttendanceLog } from '../types';

// Helper to convert Float32Array to Array (kept for compatibility with Register.jsx)
export const descriptorToArray = (descriptor: Float32Array): number[] => {
    return Array.from(descriptor);
};

export const arrayToDescriptor = (array: number[]): Float32Array => {
    return new Float32Array(array);
};

// --- USERS ---

export const getUsers = async (): Promise<User[]> => {
    try {
        return await db.users.toArray();
    } catch (err) {
        console.error('Failed to fetch users from Dexie:', err);
        return [];
    }
};

export const saveUser = async (user: Omit<User, 'id' | 'createdAt'>): Promise<User> => {
    const newUser: User = {
        ...user,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };

    await db.users.add(newUser);
    return newUser;
};

export const deleteUser = async (userId: string): Promise<void> => {
    await db.users.delete(userId);
};

export const updateUser = async (userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> => {
    await db.users.update(userId, updates);
};

// --- ATTENDANCE ---

export const getAttendance = async (): Promise<AttendanceLog[]> => {
    try {
        return await db.attendance.orderBy('timestamp').reverse().toArray();
    } catch (err) {
        console.error('Failed to fetch attendance from Dexie:', err);
        return [];
    }
};

export const saveAttendance = async (log: Omit<AttendanceLog, 'id' | 'timestamp'>): Promise<AttendanceLog> => {
    const newLog: AttendanceLog = {
        ...log,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
    };
    await db.attendance.add(newLog);
    return newLog;
};

export const clearAttendance = async (): Promise<void> => {
    await db.attendance.clear();
};
