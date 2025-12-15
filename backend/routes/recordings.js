const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const queueService = require('../services/queueService');

// Configure multer for recording uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/recordings/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Get extension from original filename or determine from mimetype
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      if (file.mimetype.includes('webm')) ext = '.webm';
      else if (file.mimetype.includes('mp4')) ext = '.mp4';
      else if (file.mimetype.includes('mp3') || file.mimetype.includes('mpeg')) ext = '.mp3';
      else ext = '.webm';
    }
    cb(null, `recording-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file extension
    const allowedExtensions = /\.(mp4|webm|mp3|wav)$/i;
    const extValid = allowedExtensions.test(file.originalname);
    
    // Check mimetype
    const allowedMimes = ['video/mp4', 'video/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm'];
    const mimeValid = allowedMimes.includes(file.mimetype);

    if (extValid || mimeValid) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, WebM, MP3, and WAV files are allowed.'));
    }
  }
});

// Start recording
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: 'Meeting ID is required'
      });
    }

    const Meeting = require('../models/Meeting');
    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is host or has recording permission
    const participant = meeting.participants.find(p => 
      p.user.toString() === req.userId.toString() && p.status === 'joined'
    );

    if (!participant || (participant.role !== 'host' && !participant.permissions.canRecord)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to record this meeting'
      });
    }

    // Check if recording is already in progress
    if (meeting.recording.isRecording) {
      return res.status(400).json({
        success: false,
        message: 'Recording is already in progress'
      });
    }

    // Start recording
    meeting.recording.isRecording = true;
    meeting.recording.startTime = new Date();
    await meeting.save();

    res.json({
      success: true,
      message: 'Recording started successfully',
      data: { recording: meeting.recording }
    });
  } catch (error) {
    console.error('Start recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Stop recording
router.post('/stop', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: 'Meeting ID is required'
      });
    }

    const Meeting = require('../models/Meeting');
    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is host or has recording permission
    const participant = meeting.participants.find(p => 
      p.user.toString() === req.userId.toString() && p.status === 'joined'
    );

    if (!participant || (participant.role !== 'host' && !participant.permissions.canRecord)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to stop recording'
      });
    }

    // Check if recording is in progress
    if (!meeting.recording.isRecording) {
      return res.status(400).json({
        success: false,
        message: 'No recording is in progress'
      });
    }

    // Stop recording
    meeting.recording.isRecording = false;
    meeting.recording.endTime = new Date();
    
    if (meeting.recording.startTime) {
      meeting.recording.duration = Math.round((meeting.recording.endTime - meeting.recording.startTime) / 1000);
    }

    await meeting.save();

    res.json({
      success: true,
      message: 'Recording stopped successfully',
      data: { recording: meeting.recording }
    });
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload recording file
router.post('/upload', authenticateToken, upload.single('recording'), async (req, res) => {
  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: 'Meeting ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No recording file uploaded'
      });
    }

    const Meeting = require('../models/Meeting');
    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is host or has recording permission
    const participant = meeting.participants.find(p => 
      p.user.toString() === req.userId.toString() && p.status === 'joined'
    );

    if (!participant || (participant.role !== 'host' && !participant.permissions.canRecord)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload recordings'
      });
    }

    // Update recording info
    meeting.recording.fileName = req.file.filename;
    meeting.recording.fileSize = req.file.size;
    meeting.recording.downloadUrl = `/uploads/recordings/${req.file.filename}`;
    meeting.recording.format = req.file.mimetype.includes('audio') ? 'mp3' : 'mp4';

    await meeting.save();

    // Queue recording for background processing (e.g., metadata extraction)
    const filePath = path.join('uploads/recordings', req.file.filename);
    await queueService.addRecordingJob(meetingId, req.file.filename, filePath);

    res.json({
      success: true,
      message: 'Recording uploaded successfully',
      data: { recording: meeting.recording }
    });
  } catch (error) {
    console.error('Upload recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's recordings
router.get('/my-recordings', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const Meeting = require('../models/Meeting');
    const meetings = await Meeting.find({
      host: req.userId,
      'recording.downloadUrl': { $exists: true }
    })
    .select('title meetingId recording createdAt participants')
    .populate('participants.user', 'username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Meeting.countDocuments({
      host: req.userId,
      'recording.downloadUrl': { $exists: true }
    });

    res.json({
      success: true,
      data: {
        recordings: meetings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get recordings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
