const { Queue, Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const emailService = require('./emailService');
const Meeting = require('../models/Meeting');
const User = require('../models/User');

// Queue names
const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  REMINDER: 'reminder-queue',
  MOM_GENERATION: 'mom-generation-queue',
  RECORDING: 'recording-queue'
};

class QueueService {
  constructor() {
    this.queues = {};
    this.workers = {};
    this.initialized = false;
  }

  // Initialize all queues and workers
  async initialize() {
    if (this.initialized) return;

    try {
      // Create queues
      this.queues.email = new Queue(QUEUE_NAMES.EMAIL, { connection: redisConfig });
      this.queues.reminder = new Queue(QUEUE_NAMES.REMINDER, { connection: redisConfig });
      this.queues.momGeneration = new Queue(QUEUE_NAMES.MOM_GENERATION, { connection: redisConfig });
      this.queues.recording = new Queue(QUEUE_NAMES.RECORDING, { connection: redisConfig });

      // Create workers
      this.createEmailWorker();
      this.createReminderWorker();
      this.createMomGenerationWorker();
      this.createRecordingWorker();

      this.initialized = true;
      console.log('Queue service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize queue service:', error.message);
      console.log('Running without Redis queues (using in-memory fallback)');
    }
  }

  // Email Worker
  createEmailWorker() {
    this.workers.email = new Worker(
      QUEUE_NAMES.EMAIL,
      async (job) => {
        const { type, data } = job.data;
        console.log(`Processing email job: ${type}`);

        switch (type) {
          case 'meeting-reminder':
            await this.processReminderEmail(data);
            break;
          case 'meeting-minutes':
            await this.processMeetingMinutesEmail(data);
            break;
          default:
            console.log(`Unknown email type: ${type}`);
        }
      },
      { connection: redisConfig, concurrency: 5 }
    );

    this.workers.email.on('completed', (job) => {
      console.log(`Email job ${job.id} completed`);
    });

    this.workers.email.on('failed', (job, err) => {
      console.error(`Email job ${job?.id} failed:`, err.message);
    });
  }


  // Reminder Worker - processes scheduled reminders
  createReminderWorker() {
    this.workers.reminder = new Worker(
      QUEUE_NAMES.REMINDER,
      async (job) => {
        const { meetingId, userId, timeLabel } = job.data;
        console.log(`Processing reminder for meeting ${meetingId}: ${timeLabel}`);

        // Fetch fresh meeting and user data
        const meeting = await Meeting.findOne({ meetingId });
        const user = await User.findById(userId);

        if (!meeting || meeting.status === 'cancelled') {
          console.log(`Meeting ${meetingId} cancelled or not found, skipping reminder`);
          return;
        }

        if (!user) {
          console.log(`User ${userId} not found, skipping reminder`);
          return;
        }

        // Add email job to email queue
        await this.addEmailJob('meeting-reminder', {
          meeting: {
            meetingId: meeting.meetingId,
            title: meeting.title,
            description: meeting.description,
            scheduledFor: meeting.scheduledFor,
            duration: meeting.duration
          },
          user: {
            email: user.email,
            username: user.username
          },
          timeLabel
        });
      },
      { connection: redisConfig }
    );

    this.workers.reminder.on('completed', (job) => {
      console.log(`Reminder job ${job.id} completed`);
    });

    this.workers.reminder.on('failed', (job, err) => {
      console.error(`Reminder job ${job?.id} failed:`, err.message);
    });
  }

  // MOM Generation Worker
  createMomGenerationWorker() {
    this.workers.momGeneration = new Worker(
      QUEUE_NAMES.MOM_GENERATION,
      async (job) => {
        const { meetingId, transcripts } = job.data;
        console.log(`Processing MOM generation for meeting ${meetingId}`);

        // Import here to avoid circular dependency
        const geminiService = require('./geminiService');
        const MeetingMinutes = require('../models/MeetingMinutes');

        const meeting = await Meeting.findOne({ meetingId })
          .populate('host', 'username email')
          .populate('participants.user', 'username email');

        if (!meeting) {
          throw new Error('Meeting not found');
        }

        const attendees = meeting.participants
          .filter(p => p.user)
          .map(p => ({
            user: p.user._id,
            name: p.user.username,
            email: p.user.email,
            role: p.role
          }));

        const startTime = meeting.scheduledFor || meeting.createdAt;
        const duration = Math.round((new Date() - new Date(startTime)) / 60000);

        // Generate AI minutes
        const aiMinutes = await geminiService.generateMeetingMinutes({
          title: meeting.title,
          date: startTime,
          duration,
          attendees,
          transcripts: transcripts || []
        });

        // Update meeting minutes in database
        await MeetingMinutes.findOneAndUpdate(
          { meetingId },
          {
            ...aiMinutes,
            status: 'completed'
          },
          { new: true }
        );

        // Queue emails to all participants
        for (const attendee of attendees) {
          if (attendee.email) {
            await this.addEmailJob('meeting-minutes', {
              meetingId,
              recipientEmail: attendee.email
            });
          }
        }

        return { success: true, meetingId };
      },
      { connection: redisConfig, concurrency: 2 }
    );

    this.workers.momGeneration.on('completed', (job) => {
      console.log(`MOM generation job ${job.id} completed`);
    });

    this.workers.momGeneration.on('failed', (job, err) => {
      console.error(`MOM generation job ${job?.id} failed:`, err.message);
    });
  }

  // Recording Processing Worker
  createRecordingWorker() {
    this.workers.recording = new Worker(
      QUEUE_NAMES.RECORDING,
      async (job) => {
        const { meetingId, fileName, filePath } = job.data;
        console.log(`Processing recording for meeting ${meetingId}: ${fileName}`);

        const fs = require('fs');
        const path = require('path');

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`Recording file not found: ${filePath}`);
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`Recording file size: ${fileSizeInMB} MB`);

        // Update meeting with recording info
        const meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          meeting.recording.fileSize = stats.size;
          meeting.recording.processedAt = new Date();
          await meeting.save();
          console.log(`Updated recording info for meeting ${meetingId}`);
        }

        return { success: true, meetingId, fileSize: stats.size };
      },
      { connection: redisConfig, concurrency: 2 }
    );

    this.workers.recording.on('completed', (job) => {
      console.log(`Recording job ${job.id} completed`);
    });

    this.workers.recording.on('failed', (job, err) => {
      console.error(`Recording job ${job?.id} failed:`, err.message);
    });
  }

  // Process reminder email
  async processReminderEmail(data) {
    const { meeting, user, timeLabel } = data;
    emailService.initialize();

    if (!emailService.transporter) {
      throw new Error('Email service not configured');
    }

    const meetingTime = new Date(meeting.scheduledFor);
    const joinLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/meeting/${meeting.meetingId}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0 0 10px 0;">⏰ Meeting Reminder</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 18px;">Starting in ${timeLabel}</p>
    </div>
    <div style="padding: 30px;">
      <h2 style="color: #1e40af; margin-top: 0;">${meeting.title}</h2>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p><strong>📅 Date:</strong> ${meetingTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>🕐 Time:</strong> ${meetingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
        <p><strong>⏱️ Duration:</strong> ${meeting.duration} minutes</p>
        <p><strong>🔑 Meeting ID:</strong> <code>${meeting.meetingId}</code></p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${joinLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: 600;">Join Meeting Now</a>
      </div>
    </div>
    <div style="padding: 20px; background: #f8fafc; text-align: center; color: #64748b; font-size: 13px;">
      <p style="margin: 0;">Automated reminder from AI Meet</p>
    </div>
  </div>
</body>
</html>`;

    await emailService.transporter.sendMail({
      from: `"AI Meet" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `⏰ Reminder: "${meeting.title}" starts in ${timeLabel}`,
      html: htmlContent
    });

    console.log(`Sent ${timeLabel} reminder to ${user.email}`);
  }

  // Process meeting minutes email
  async processMeetingMinutesEmail(data) {
    const { meetingId, recipientEmail } = data;
    console.log(`Processing meeting minutes email for meeting ${meetingId} to ${recipientEmail}`);
    
    const MeetingMinutes = require('../models/MeetingMinutes');

    const minutes = await MeetingMinutes.findOne({ meetingId });
    if (!minutes) {
      console.error(`Meeting minutes not found for meeting ${meetingId}`);
      throw new Error('Meeting minutes not found');
    }

    console.log(`Found meeting minutes, status: ${minutes.status}`);
    
    const results = await emailService.sendMeetingMinutes(minutes, [{ email: recipientEmail }]);
    console.log(`Email send results:`, results);
    
    return results;
  }

  // Add email job to queue
  async addEmailJob(type, data, options = {}) {
    if (!this.initialized) {
      // Fallback: send immediately if queue not available
      console.log('Queue not available, sending email directly');
      if (type === 'meeting-reminder') {
        await this.processReminderEmail(data);
      } else if (type === 'meeting-minutes') {
        await this.processMeetingMinutesEmail(data);
      }
      return;
    }

    return this.queues.email.add(type, { type, data }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...options
    });
  }

  // Schedule meeting reminders (1hr, 30min, 15min, 5min before)
  async scheduleReminders(meeting, user) {
    const meetingTime = new Date(meeting.scheduledFor).getTime();
    const now = Date.now();

    const reminderIntervals = [
      { minutes: 60, label: '1 hour' },
      { minutes: 30, label: '30 minutes' },
      { minutes: 15, label: '15 minutes' },
      { minutes: 5, label: '5 minutes' }
    ];

    for (const interval of reminderIntervals) {
      const reminderTime = meetingTime - (interval.minutes * 60 * 1000);
      const delay = reminderTime - now;

      if (delay > 0) {
        if (this.initialized) {
          await this.queues.reminder.add(
            `reminder-${meeting.meetingId}-${interval.minutes}`,
            {
              meetingId: meeting.meetingId,
              userId: user._id.toString(),
              timeLabel: interval.label
            },
            {
              delay,
              jobId: `reminder-${meeting.meetingId}-${interval.minutes}`,
              removeOnComplete: true
            }
          );
          console.log(`Scheduled ${interval.label} reminder for meeting ${meeting.meetingId}`);
        } else {
          // Fallback to setTimeout if Redis not available
          setTimeout(async () => {
            try {
              await this.addEmailJob('meeting-reminder', {
                meeting: {
                  meetingId: meeting.meetingId,
                  title: meeting.title,
                  description: meeting.description,
                  scheduledFor: meeting.scheduledFor,
                  duration: meeting.duration
                },
                user: { email: user.email, username: user.username },
                timeLabel: interval.label
              });
            } catch (err) {
              console.error(`Failed to send reminder:`, err);
            }
          }, delay);
        }
      }
    }
  }

  // Cancel all reminders for a meeting
  async cancelReminders(meetingId) {
    if (!this.initialized) return;

    const intervals = [60, 30, 15, 5];
    for (const minutes of intervals) {
      try {
        const job = await this.queues.reminder.getJob(`reminder-${meetingId}-${minutes}`);
        if (job) {
          await job.remove();
          console.log(`Cancelled ${minutes}min reminder for meeting ${meetingId}`);
        }
      } catch (err) {
        // Job might not exist, ignore
      }
    }
  }

  // Add MOM generation job
  async addMomGenerationJob(meetingId, transcripts = []) {
    if (!this.initialized) {
      console.log('Queue not available, generating MOM directly');
      // Will be handled synchronously in controller
      return null;
    }

    return this.queues.momGeneration.add(
      `mom-${meetingId}`,
      { meetingId, transcripts },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 }
      }
    );
  }

  // Add recording processing job
  async addRecordingJob(meetingId, fileName, filePath) {
    if (!this.initialized) {
      console.log('Queue not available, skipping recording processing');
      return null;
    }

    return this.queues.recording.add(
      `recording-${meetingId}`,
      { meetingId, fileName, filePath },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 }
      }
    );
  }

  // Get queue statistics
  async getStats() {
    if (!this.initialized) return null;

    const stats = {};
    for (const [name, queue] of Object.entries(this.queues)) {
      const counts = await queue.getJobCounts();
      stats[name] = counts;
    }
    return stats;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down queue service...');
    for (const worker of Object.values(this.workers)) {
      await worker.close();
    }
    for (const queue of Object.values(this.queues)) {
      await queue.close();
    }
    console.log('Queue service shut down');
  }
}

module.exports = new QueueService();
