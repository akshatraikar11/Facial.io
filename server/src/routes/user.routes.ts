import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/userController.js';

const router = Router();

// Get all users
router.get('/', optionalAuth, asyncHandler(getAllUsers));

// Get user by ID
router.get('/:id', optionalAuth, asyncHandler(getUserById));

// Create user
router.post('/', asyncHandler(createUser));

// Update user
router.patch('/:id', authenticate, asyncHandler(updateUser));

// Delete user
router.delete('/:id', authenticate, asyncHandler(deleteUser));

export default router;
