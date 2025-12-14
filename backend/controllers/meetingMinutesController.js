const MeetingMinutes = require('../models/MeetingMinutes');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const geminiService = require('../services/geminiService');
const emailService = require('../services/emailService');

const meetingMinutesController = {
  // Generate meeting minutes after meeting ends
  async generateMinutes(req, res) {
    try {
      const { meetingId } = req.params;
      const { transcripts } = req.body; // Optional: transcripts from client

      const meeting = await Meeting.findOne({ meetingId })
        .populate('host', 'username email')
        .populate('participants.user', 'username email');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check if user is host
      if (meeting.host._id.toString() !== req.userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only host can generate meeting minutes'
        });
      }

      // Check if minutes already exist
      let existingMinutes = await MeetingMinutes.findOne({ meetingId });
      if (existingMinutes && existingMinutes.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Meeting minutes already generated',
          data: { minutes: existingMinutes }
        });
      }

      // Prepare attendees data
      const attendees = meeting.participants
        .filter(p => p.user)
        .map(p => ({
          user: p.user._id,
          name: p.user.username,
          email: p.user.email,
          role: p.role,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          duration: p.leftAt && p.joinedAt 
            ? Math.round((new Date(p.leftAt) - new Date(p.joinedAt)) / 60000)
            : null
        }));

      // Calculate meeting duration
      const startTime = meeting.scheduledFor || meeting.createdAt;
      const endTime = new Date();
      const duration = Math.round((endTime - new Date(startTime)) / 60000);

      // Create or update meeting minutes record
      const minutesData = {
        meeting: meeting._id,
        meetingId: meeting.meetingId,
        title: meeting.title || 'Untitled Meeting',
        date: startTime,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        attendees: attendees,
        transcripts: transcripts || [],
        status: 'processing'
      };

      let meetingMinutes;
      if (existingMinutes) {
        meetingMinutes = await MeetingMinutes.findByIdAndUpdate(
          existingMinutes._id,
          minutesData,
          { new: true }
        );
      } else {
        meetingMinutes = new MeetingMinutes(minutesData);
        await meetingMinutes.save();
      }


      // Generate AI-powered minutes using Gemini
      try {
        const aiMinutes = await geminiService.generateMeetingMinutes({
          title: meeting.title,
          date: startTime,
          duration: duration,
          attendees: attendees,
          transcripts: transcripts || []
        });

        // Update with AI-generated content
        meetingMinutes.summary = aiMinutes.summary;
        meetingMinutes.agenda = aiMinutes.agenda;
        meetingMinutes.discussionPoints = aiMinutes.discussionPoints;
        meetingMinutes.decisions = aiMinutes.decisions;
        meetingMinutes.actionItems = aiMinutes.actionItems;
        meetingMinutes.highlights = aiMinutes.highlights;
        meetingMinutes.questionsRaised = aiMinutes.questionsRaised;
        meetingMinutes.followUps = aiMinutes.followUps;
        meetingMinutes.aiProcessing = aiMinutes.aiProcessing;
        meetingMinutes.status = 'completed';

        await meetingMinutes.save();

        // Send email to all participants
        const recipients = attendees.filter(a => a.email);
        if (recipients.length > 0) {
          const emailResults = await emailService.sendMeetingMinutes(meetingMinutes, recipients);
          
          meetingMinutes.emailDelivery = {
            sent: true,
            sentAt: new Date(),
            recipients: emailResults
          };
          await meetingMinutes.save();
        }

        res.json({
          success: true,
          message: 'Meeting minutes generated and sent successfully',
          data: { minutes: meetingMinutes }
        });

      } catch (aiError) {
        console.error('AI processing error:', aiError);
        meetingMinutes.status = 'failed';
        meetingMinutes.error = aiError.message;
        await meetingMinutes.save();

        res.status(500).json({
          success: false,
          message: 'Failed to generate AI meeting minutes',
          error: aiError.message
        });
      }

    } catch (error) {
      console.error('Generate minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get meeting minutes by meeting ID
  async getMinutes(req, res) {
    try {
      const { meetingId } = req.params;

      const minutes = await MeetingMinutes.findOne({ meetingId })
        .populate('attendees.user', 'username email avatar');

      if (!minutes) {
        return res.status(404).json({
          success: false,
          message: 'Meeting minutes not found'
        });
      }

      res.json({
        success: true,
        data: { minutes }
      });
    } catch (error) {
      console.error('Get minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Get all meeting minutes for a user
  async getUserMinutes(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const minutes = await MeetingMinutes.find({
        'attendees.user': req.userId
      })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await MeetingMinutes.countDocuments({
        'attendees.user': req.userId
      });

      res.json({
        success: true,
        data: {
          minutes,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get user minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Resend meeting minutes email
  async resendEmail(req, res) {
    try {
      const { meetingId } = req.params;
      const { email } = req.body;

      const minutes = await MeetingMinutes.findOne({ meetingId });

      if (!minutes) {
        return res.status(404).json({
          success: false,
          message: 'Meeting minutes not found'
        });
      }

      if (minutes.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Meeting minutes not yet generated'
        });
      }

      const recipients = email 
        ? [{ email }] 
        : minutes.attendees.filter(a => a.email);

      const emailResults = await emailService.sendMeetingMinutes(minutes, recipients);

      res.json({
        success: true,
        message: 'Meeting minutes email sent',
        data: { results: emailResults }
      });
    } catch (error) {
      console.error('Resend email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

module.exports = meetingMinutesController;
