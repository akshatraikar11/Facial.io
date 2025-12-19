import { Router } from 'express';
import { login, register, verifyToken, verifyPin } from '../controllers/authController.js';

const router = Router();

// Login
router.post('/login', login);

// Register
router.post('/register', register);

// Verify token
router.get('/verify', verifyToken);

// Verify PIN
router.post('/verify-pin', verifyPin);

export default router;
