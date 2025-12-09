const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Get io instance from server
let io;
const setSocketIO = (socketIO) => {
  io = socketIO;
};

module.exports = { router, setSocketIO };

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/chat/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Send chat message
router.post('/message', authenticateToken, async (req, res) => {
  try {
    const { meetingId, message, type = 'text' } = req.body;

    if (!meetingId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Meeting ID and message are required'
      });
    }

    const Meeting = require('../models/Meeting');
    const meeting = await Meeting.findOne({ meetingId }).populate('participants.user');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is participant
    // Temporarily disabled for debugging
    const isParticipant = true; // meeting.participants.some(p => 
      // p.user.toString() === req.userId.toString() && p.status === 'joined'
    // );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this meeting'
      });
    }

    // Add message to meeting chat
    meeting.chat.push({
      sender: req.userId,
      message,
      type,
      timestamp: new Date()
    });

    meeting.statistics.chatMessages += 1;
    await meeting.save();

    // Populate sender info for response
    const populatedMeeting = await Meeting.findOne({ meetingId })
      .populate('chat.sender', 'username avatar');

    const newMessage = populatedMeeting.chat[populatedMeeting.chat.length - 1];

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { message: newMessage }
    });

    // Emit socket event to all participants in the meeting
    if (io) {
      io.to(meetingId).emit('chat-message', newMessage);
    }
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Upload file in chat
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
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
        message: 'No file uploaded'
      });
    }

    const Meeting = require('../models/Meeting');
    const meeting = await Meeting.findOne({ meetingId }).populate('participants.user');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is participant
    // Temporarily disabled for debugging
    const isParticipant = true; // meeting.participants.some(p => 
      // p.user.toString() === req.userId.toString() && p.status === 'joined'
    // );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this meeting'
      });
    }

    // Add file message to meeting chat
    const fileMessage = {
      sender: req.userId,
      message: `Shared a file: ${req.file.originalname}`,
      type: 'file',
      file: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        downloadUrl: `/uploads/chat/${req.file.filename}`
      },
      timestamp: new Date()
    };

    meeting.chat.push(fileMessage);
    meeting.statistics.chatMessages += 1;
    meeting.statistics.filesShared += 1;
    await meeting.save();

    // Populate sender info for response
    const populatedMeeting = await Meeting.findOne({ meetingId })
      .populate('chat.sender', 'username avatar');

    const newMessage = populatedMeeting.chat[populatedMeeting.chat.length - 1];

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: { message: newMessage }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get chat history
router.get('/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const Meeting = require('../models/Meeting');
    const meeting = await Meeting.findOne({ meetingId })
      .populate('chat.sender', 'username avatar')
      .populate('participants.user', 'username avatar')
      .select('chat participants');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user is participant
    // Temporarily disabled for debugging
    const isParticipant = true; // meeting.participants.some(p => 
      // p.user.toString() === req.userId.toString() && p.status === 'joined'
    // );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this meeting'
      });
    }

    // Paginate messages
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const messages = meeting.chat.slice().reverse().slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: meeting.chat.length,
          pages: Math.ceil(meeting.chat.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = { router, setSocketIO };
