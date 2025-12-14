const express = require('express');
const router = express.Router();
const meetingMinutesController = require('../controllers/meetingMinutesController');
const { authenticateToken } = require('../middleware/auth');

// Get all meeting minutes for current user (must be before /:meetingId routes)
router.get('/', authenticateToken, meetingMinutesController.getUserMinutes);

// Generate meeting minutes (host only)
router.post('/:meetingId/generate', authenticateToken, meetingMinutesController.generateMinutes);

// Get meeting minutes by meeting ID
router.get('/:meetingId', authenticateToken, meetingMinutesController.getMinutes);

// Resend meeting minutes email
router.post('/:meetingId/resend-email', authenticateToken, meetingMinutesController.resendEmail);

module.exports = router;
