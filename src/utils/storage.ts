/**
 * storage.ts — Dexie (IndexedDB) helpers for local-only data.
 *
 * This is used exclusively by the legacy Kiosk flow that does
 * client-side face matching. The main app uses the server API.
 */
import { db } from './db';
import type { LocalUser } from '../types';

export const descriptorToArray = (descriptor: Float32Array): number[] =>
  Array.from(descriptor);

export const arrayToDescriptor = (array: number[]): Float32Array =>
  new Float32Array(array);

// ── Users ─────────────────────────────────────────────────────────────────

export const getUsers = async (): Promise<LocalUser[]> => {
  try {
    return await db.users.toArray();
  } catch (err) {
    console.error('Failed to fetch users from Dexie:', err);
    return [];
  }
};

export const saveUser = async (
  user: Omit<LocalUser, 'id' | 'createdAt'>,
): Promise<LocalUser> => {
  const newUser: LocalUser = {
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

export const updateUser = async (
  userId: string,
  updates: Partial<Omit<LocalUser, 'id' | 'createdAt'>>,
): Promise<void> => {
  await db.users.update(userId, updates);
};

// ── Attendance (local only) ───────────────────────────────────────────────

export const saveAttendance = async (log: {
  userId: string;
  userName: string;
  type: string;
  confidence: number;
  method: string;
}): Promise<void> => {
  await db.attendance.add({
    ...log,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
};
