const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() {
      return !this.isGuest;
    },
    minlength: 6
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  profile: {
    firstName: String,
    lastName: String,
    bio: String,
    company: String,
    jobTitle: String
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    },
    audio: {
      inputDevice: String,
      outputDevice: String,
      volume: { type: Number, default: 100 }
    },
    video: {
      inputDevice: String,
      quality: {
        type: String,
        enum: ['low', 'medium', 'high', 'auto'],
        default: 'auto'
      }
    }
  },
  statistics: {
    totalMeetings: { type: Number, default: 0 },
    totalMeetingTime: { type: Number, default: 0 }, // in minutes
    meetingsHosted: { type: Number, default: 0 },
    meetingsAttended: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', function() {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || this.isGuest) {
    return;
  }
  
  const salt = bcrypt.genSaltSync(12);
  this.password = bcrypt.hashSync(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.isGuest) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Get public user info
userSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    profile: this.profile,
    isGuest: this.isGuest,
    statistics: this.statistics,
    isActive: this.isActive,
    lastSeen: this.lastSeen
  };
};

module.exports = mongoose.model('User', userSchema);
