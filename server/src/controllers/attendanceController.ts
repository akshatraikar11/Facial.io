import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

const createAttendanceSchema = z.object({
    userId: z.string().uuid(),
    name: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    status: z.string().default('Present'),
});

export const getAttendanceLogs = async (req: AuthRequest, res: Response) => {
    const { userId, date, startDate, endDate } = req.query;

    const filters: any = {};
    if (userId) filters.userId = userId as string;
    if (date) filters.date = date as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;

    const logs = await db.getAttendance(filters);
    res.json({ status: 'success', data: logs });
};

export const getTodayAttendance = async (req: AuthRequest, res: Response) => {
    const today = new Date().toISOString().slice(0, 10);
    const logs = await db.getAttendance({ date: today });
    res.json({ status: 'success', data: logs });
};

export const createAttendance = async (req: Request, res: Response, next: NextFunction) => {
    const validation = createAttendanceSchema.safeParse(req.body);
    if (!validation.success) {
        const err: AppError = new Error('Invalid attendance data');
        err.statusCode = 400;
        return next(err);
    }

    // Check if user exists
    const user = await db.getUserById(validation.data.userId);
    if (!user) {
        const err: AppError = new Error('User not found');
        err.statusCode = 404;
        return next(err);
    }

    // Check if already logged today
    const existingLog = await db.getAttendance({
        userId: validation.data.userId,
        date: validation.data.date,
    });

    if (existingLog.length > 0) {
        const err: AppError = new Error('Attendance already logged for this date');
        err.statusCode = 409;
        return next(err);
    }

    const log = await db.createAttendance(validation.data);
    res.status(201).json({ status: 'success', data: log });
};

export const deleteAttendance = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const deleted = await db.deleteAttendance(req.params.id);
    if (!deleted) {
        const err: AppError = new Error('Attendance log not found');
        err.statusCode = 404;
        return next(err);
    }

    res.json({ status: 'success', message: 'Attendance log deleted' });
};

export const clearAttendance = async (req: AuthRequest, res: Response) => {
    await db.clearAttendance();
    res.json({ status: 'success', message: 'All attendance logs cleared' });
};
