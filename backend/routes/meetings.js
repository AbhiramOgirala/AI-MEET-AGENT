const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateToken } = require('../middleware/auth');

// Create a new meeting
router.post('/', authenticateToken, meetingController.createMeeting);

// Schedule a meeting
router.post('/schedule', authenticateToken, meetingController.scheduleMeeting);

// Get meeting by ID
router.get('/:meetingId', authenticateToken, meetingController.getMeeting);

// Join a meeting
router.post('/:meetingId/join', authenticateToken, meetingController.joinMeeting);

// Leave a meeting
router.post('/:meetingId/leave', authenticateToken, meetingController.leaveMeeting);

// Get user's meetings
router.get('/', authenticateToken, meetingController.getUserMeetings);

// Update meeting settings (host only)
router.put('/:meetingId/settings', authenticateToken, meetingController.updateMeetingSettings);

// End meeting (host only)
router.post('/:meetingId/end', authenticateToken, meetingController.endMeeting);

// Cancel scheduled meeting (host only)
router.post('/:meetingId/cancel', authenticateToken, meetingController.cancelMeeting);

module.exports = router;
