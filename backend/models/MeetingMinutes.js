const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assigneeName: String,
  deadline: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  }
});

const decisionSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  madeBy: String,
  timestamp: Date
});

const discussionPointSchema = new mongoose.Schema({
  topic: String,
  summary: String,
  speakers: [String],
  startTime: Date,
  endTime: Date
});

const transcriptSegmentSchema = new mongoose.Schema({
  speakerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  speakerName: String,
  startTime: Date,
  endTime: Date,
  text: String,
  confidence: Number
});

const meetingMinutesSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  meetingId: {
    type: String,
    required: true,
    index: true
  },
  
  // Attendees information
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    role: {
      type: String,
      enum: ['host', 'co-host', 'participant'],
      default: 'participant'
    },
    joinedAt: Date,
    leftAt: Date,
    duration: Number // in minutes
  }],

  // Meeting metadata
  title: String,
  date: Date,
  startTime: Date,
  endTime: Date,
  duration: Number, // in minutes
  
  // Agenda (if provided beforehand or extracted)
  agenda: [String],
  
  // Raw transcripts with speaker identification
  transcripts: [transcriptSegmentSchema],
  
  // Processed content
  summary: {
    type: String,
    maxlength: 5000
  },
  
  // Key discussion points
  discussionPoints: [discussionPointSchema],
  
  // Decisions made during the meeting
  decisions: [decisionSchema],
  
  // Action items with assignments
  actionItems: [actionItemSchema],
  
  // Key highlights/important moments
  highlights: [String],
  
  // Questions raised (and their answers if available)
  questionsRaised: [{
    question: String,
    askedBy: String,
    answer: String,
    answeredBy: String
  }],
  
  // Follow-up items
  followUps: [{
    description: String,
    responsible: String,
    dueDate: Date
  }],
  
  // AI processing metadata
  aiProcessing: {
    model: String,
    processedAt: Date,
    tokensUsed: Number,
    confidence: Number
  },
  
  // Email delivery status
  emailDelivery: {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    recipients: [{
      email: String,
      status: {
        type: String,
        enum: ['pending', 'queued', 'sent', 'failed'],
        default: 'pending'
      },
      sentAt: Date,
      error: String
    }]
  },
  
  // Status
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  
  error: String
  
}, {
  timestamps: true
});

// Index for efficient queries
meetingMinutesSchema.index({ meeting: 1 });
meetingMinutesSchema.index({ 'attendees.user': 1 });
meetingMinutesSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MeetingMinutes', meetingMinutesSchema);
