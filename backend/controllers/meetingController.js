const Meeting = require('../models/Meeting');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

const meetingController = {
  // Create a new meeting
  async createMeeting(req, res) {
    try {
      const { title, description, scheduledFor, duration, settings } = req.body;
      
      // Generate a unique meeting ID
      const generateMeetingId = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 9; i++) {
          if (i === 3 || i === 6) result += '-';
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      const meeting = new Meeting({
        title,
        description,
        host: req.userId,
        meetingId: generateMeetingId(),
        scheduledFor: scheduledFor || new Date(),
        duration: duration || 60,
        settings: settings || {}
      });

      // Add host as first participant
      meeting.participants.push({
        user: req.userId,
        role: 'host',
        joinedAt: new Date(),
        status: 'joined'
      });

      await meeting.save();

      // Update user statistics
      await User.findByIdAndUpdate(req.userId, {
        $inc: { 'statistics.meetingsHosted': 1, 'statistics.totalMeetings': 1 }
      });

      res.status(201).json({
        success: true,
        message: 'Meeting created successfully',
        data: { meeting }
      });
    } catch (error) {
      console.error('Create meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get meeting by ID
  async getMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      
      const meeting = await Meeting.findOne({ meetingId })
        .populate('host', 'username email avatar')
        .populate('participants.user', 'username email avatar');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      res.json({
        success: true,
        data: { meeting }
      });
    } catch (error) {
      console.error('Get meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Join a meeting
  async joinMeeting(req, res) {
    try {
      const { meetingId } = req.params;
      const { password } = req.body || {}; // Handle undefined req.body

      const meeting = await Meeting.findOne({ meetingId }); // Find by meetingId, not _id

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check if meeting has ended
      if (meeting.status === 'ended' || meeting.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Meeting is no longer available'
        });
      }

      // Check password if required
      if (meeting.settings.requirePassword && meeting.password !== password) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect meeting password'
        });
      }

      // Check max participants
      const currentParticipants = meeting.participants.filter(p => p.status === 'joined').length;
      if (currentParticipants >= meeting.settings.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Meeting is full'
        });
      }

      // Add participant
      const existingParticipant = meeting.participants.find(p => 
        p.user.toString() === req.userId.toString()
      );
      
      let isFirstJoin = false;
      if (!existingParticipant) {
        // Never joined this meeting before
        meeting.participants.push({
          user: req.userId,
          role: 'participant',
          joinedAt: new Date(),
          status: 'joined'
        });
        isFirstJoin = true;
      } else if (existingParticipant.status !== 'joined') {
        // Rejoining after leaving
        existingParticipant.status = 'joined';
        existingParticipant.joinedAt = new Date();
        // Don't increment statistics - they've already attended before
      }

      // Update user statistics (only on first time ever joining this meeting)
      if (isFirstJoin) {
        await User.findByIdAndUpdate(req.userId, {
          $inc: { 'statistics.meetingsAttended': 1, 'statistics.totalMeetings': 1 }
        });
      }

      // Update meeting status to ongoing if first participant joins
      if (meeting.status === 'scheduled') {
        meeting.status = 'ongoing';
        await meeting.save();
      }

      res.json({
        success: true,
        message: 'Joined meeting successfully',
        data: { meeting }
      });
    } catch (error) {
      console.error('Join meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Leave a meeting
  async leaveMeeting(req, res) {
    try {
      const { meetingId } = req.params;

      const meeting = await Meeting.findOne({ meetingId });
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Find and remove participant
      const participant = meeting.participants.find(p => 
        p.user.toString() === req.userId.toString() && p.status === 'joined'
      );

      if (participant) {
        participant.status = 'left';
        participant.leftAt = new Date();
        
        // Update total participants count
        meeting.statistics.totalParticipants = meeting.participants.filter(p => p.status === 'joined').length;
        
        // If host leaves, transfer host control to another participant
        if (participant.role === 'host') {
          const remainingParticipants = meeting.participants.filter(p => p.status === 'joined');
          
          if (remainingParticipants.length > 0) {
            // Look for co-host first
            const coHost = remainingParticipants.find(p => p.role === 'co-host');
            const newHost = coHost || remainingParticipants[0]; // Fall back to any participant
            
            // Transfer host role
            newHost.role = 'host';
            participant.role = 'participant'; // Previous host becomes regular participant
            
            // Update meeting host
            meeting.host = newHost.user;
          } else {
            // No participants left, end the meeting
            meeting.status = 'ended';
          }
        }
        
        await meeting.save();
      }

      res.json({
        success: true,
        message: 'Left meeting successfully'
      });
    } catch (error) {
      console.error('Leave meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get user's meetings
  async getUserMeetings(req, res) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      let query = {
        $or: [
          { host: req.userId },
          { 'participants.user': req.userId }
        ]
      };

      if (status) {
        query.status = status;
      }

      const meetings = await Meeting.find(query)
        .populate('host', 'username email avatar')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Meeting.countDocuments(query);

      res.json({
        success: true,
        data: {
          meetings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get user meetings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Update meeting settings (host only)
  async updateMeetingSettings(req, res) {
    try {
      const { meetingId } = req.params;
      const { settings } = req.body;

      const meeting = await Meeting.findById(meetingId);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check if user is host
      if (meeting.host.toString() !== req.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only host can update meeting settings'
        });
      }

      meeting.settings = { ...meeting.settings, ...settings };
      await meeting.save();

      res.json({
        success: true,
        message: 'Meeting settings updated successfully',
        data: { meeting }
      });
    } catch (error) {
      console.error('Update meeting settings error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // End meeting (host only)
  async endMeeting(req, res) {
    try {
      const { meetingId } = req.params;

      const meeting = await Meeting.findById(meetingId);

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check if user is host
      if (meeting.host.toString() !== req.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only host can end meeting'
        });
      }

      meeting.status = 'ended';
      
      // Calculate total duration
      const startTime = meeting.scheduledFor;
      const endTime = new Date();
      meeting.statistics.totalDuration = Math.round((endTime - startTime) / 60000); // in minutes

      await meeting.save();

      res.json({
        success: true,
        message: 'Meeting ended successfully'
      });
    } catch (error) {
      console.error('End meeting error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

module.exports = meetingController;
