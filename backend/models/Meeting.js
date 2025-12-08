const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meetingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  password: {
    type: String,
    default: null
  },
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  settings: {
    allowGuests: { type: Boolean, default: true },
    requirePassword: { type: Boolean, default: false },
    enableRecording: { type: Boolean, default: false },
    enableChat: { type: Boolean, default: true },
    enableScreenShare: { type: Boolean, default: true },
    enableRaiseHand: { type: Boolean, default: true },
    enableReactions: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 50 },
    waitingRoom: { type: Boolean, default: false },
    muteOnEntry: { type: Boolean, default: false },
    videoOnEntry: { type: Boolean, default: false }
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    role: {
      type: String,
      enum: ['host', 'co-host', 'participant'],
      default: 'participant'
    },
    status: {
      type: String,
      enum: ['joined', 'left', 'removed'],
      default: 'joined'
    },
    permissions: {
      canShare: { type: Boolean, default: true },
      canRecord: { type: Boolean, default: false },
      canMuteOthers: { type: Boolean, default: false },
      canRemoveOthers: { type: Boolean, default: false }
    },
    mediaState: {
      audioEnabled: { type: Boolean, default: true },
      videoEnabled: { type: Boolean, default: true },
      screenSharing: { type: Boolean, default: false },
      handRaised: { type: Boolean, default: false }
    }
  }],
  recording: {
    isRecording: { type: Boolean, default: false },
    startTime: Date,
    endTime: Date,
    fileName: String,
    fileSize: Number,
    duration: Number,
    format: {
      type: String,
      enum: ['mp4', 'webm', 'mp3'],
      default: 'mp4'
    },
    downloadUrl: String,
    thumbnailUrl: String
  },
  chat: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['text', 'file', 'system'],
      default: 'text'
    }
  }],
  statistics: {
    totalParticipants: { type: Number, default: 0 },
    peakParticipants: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 },
    filesShared: { type: Number, default: 0 },
    screenShares: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

meetingSchema.pre('save', function() {
  if (this.isNew && !this.meetingId) {
    this.meetingId = this.generateMeetingId();
  }
});

meetingSchema.methods.generateMeetingId = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 6) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

meetingSchema.methods.addParticipant = function(userId, role = 'participant') {
  const existingParticipant = this.participants.find(p => 
    p.user.toString() === userId.toString() && p.status === 'joined'
  );
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      role,
      joinedAt: new Date(),
      status: 'joined'
    });
    this.statistics.totalParticipants = this.participants.filter(p => p.status === 'joined').length;
    this.statistics.peakParticipants = Math.max(this.statistics.peakParticipants, this.statistics.totalParticipants);
  }
  
  return this.save();
};

module.exports = mongoose.model('Meeting', meetingSchema);
