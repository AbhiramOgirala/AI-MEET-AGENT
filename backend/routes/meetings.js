const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { authenticateToken } = require('../middleware/auth');
const { iceServers } = require('../config/webrtc');

// Get ICE servers for WebRTC
router.get('/ice-servers', authenticateToken, (req, res) => {
  res.json({ success: true, data: { iceServers } });
});

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

// Save transcripts for a meeting
router.post('/:meetingId/transcripts', authenticateToken, meetingController.saveTranscripts);

// Get transcripts for a meeting
router.get('/:meetingId/transcripts', authenticateToken, meetingController.getTranscripts);

module.exports = router;
