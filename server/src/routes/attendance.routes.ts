import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getAttendanceLogs,
  getTodayAttendance,
  createAttendance,
  deleteAttendance,
  clearAttendance
} from '../controllers/attendanceController.js';

const router = Router();

// Get attendance logs with optional filters
router.get('/', optionalAuth, asyncHandler(getAttendanceLogs));

// Get today's attendance
router.get('/today', optionalAuth, asyncHandler(getTodayAttendance));

// Create attendance log
router.post('/', asyncHandler(createAttendance));

// Delete attendance log
router.delete('/:id', optionalAuth, asyncHandler(deleteAttendance));

// Clear all attendance
router.delete('/', optionalAuth, asyncHandler(clearAttendance));

export default router;
