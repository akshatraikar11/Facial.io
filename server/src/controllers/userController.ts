import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

const createUserSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    descriptor: z.array(z.number()).length(128),
    password: z.string().min(6).optional(), // Optional for now, added support
});

const updateUserSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    descriptor: z.array(z.number()).length(128).optional(),
    password: z.string().min(6).optional(),
});

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    const users = await db.getUsers();
    // Sending descriptors to frontend to enable client-side face matching
    res.json({ status: 'success', data: users });
};

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = await db.getUserById(req.params.id);
    if (!user) {
        const err: AppError = new Error('User not found');
        err.statusCode = 404;
        return next(err);
    }
    // Don't send descriptor unless authenticated
    if (!req.user) {
        const { descriptor, password, ...userWithoutSensitive } = user;
        return res.json({ status: 'success', data: userWithoutSensitive });
    }
    // Remove password from response
    const { password, ...userSanitized } = user;
    res.json({ status: 'success', data: userSanitized });
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
        const err: AppError = new Error('Invalid user data');
        err.statusCode = 400;
        return next(err);
    }

    const { email } = validation.data;

    // Check for duplicate email
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
        const err: AppError = new Error('User with this email already exists');
        err.statusCode = 409;
        return next(err);
    }

    const user = await db.createUser(validation.data);
    const { password, ...userSanitized } = user;

    res.status(201).json({ status: 'success', data: userSanitized });
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
        const err: AppError = new Error('Invalid update data');
        err.statusCode = 400;
        return next(err);
    }

    const user = await db.updateUser(req.params.id, validation.data);
    if (!user) {
        const err: AppError = new Error('User not found');
        err.statusCode = 404;
        return next(err);
    }

    const { password, ...userSanitized } = user;
    res.json({ status: 'success', data: userSanitized });
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const deleted = await db.deleteUser(req.params.id);
    if (!deleted) {
        const err: AppError = new Error('User not found');
        err.statusCode = 404;
        return next(err);
    }

    res.json({ status: 'success', message: 'User deleted successfully' });
};
