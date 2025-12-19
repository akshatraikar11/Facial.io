import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { db } from '../db.js';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
});

const pinSchema = z.object({
    pin: z.string().length(4),
});

// Simple admin user for demo (legacy support)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cryo.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
        const err: AppError = new Error('Invalid email or password format');
        err.statusCode = 400;
        return next(err);
    }

    const { email, password } = validation.data;

    // 1. Check hardcoded admin first (for backward compatibility/initial setup)
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign(
            { id: 'admin', email },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
        );

        return res.json({
            status: 'success',
            token,
            user: { id: 'admin', email },
        });
    }

    // 2. Check database users
    const user = await db.getUserByEmail(email);

    if (user && user.password) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign(
                { id: user.id, email: user.email },
                config.jwtSecret,
                { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
            );

            const { password: _, ...userWithoutPassword } = user;

            return res.json({
                status: 'success',
                token,
                user: userWithoutPassword,
            });
        }
    }

    const err: AppError = new Error('Invalid credentials');
    err.statusCode = 401;
    next(err);
});

export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
        const err: AppError = new Error('Invalid registration data');
        err.statusCode = 400;
        return next(err);
    }

    const { name, email, password } = validation.data;

    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
        const err: AppError = new Error('User with this email already exists');
        err.statusCode = 409;
        return next(err);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await db.createUser({
        name,
        email,
        password: hashedPassword,
        descriptor: [], // No face descriptor for basic auth registration
    });

    // Generate Token
    const token = jwt.sign(
        { id: newUser.id, email: newUser.email },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
        status: 'success',
        token,
        user: userWithoutPassword,
    });
});

export const verifyToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ status: 'error', message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        res.json({ status: 'success', user: decoded });
    } catch (error) {
        res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
});

export const verifyPin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const validation = pinSchema.safeParse(req.body);
    if (!validation.success) {
        const err: AppError = new Error('Invalid PIN format');
        err.statusCode = 400;
        return next(err);
    }

    const { pin } = validation.data;

    if (pin === config.adminPin) {
        return res.json({
            status: 'success',
            message: 'PIN verified'
        });
    }

    const err: AppError = new Error('Incorrect PIN');
    err.statusCode = 401;
    next(err);
});
