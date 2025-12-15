const emailService = require('./emailService');

class SchedulerService {
  constructor() {
    // Store scheduled timeouts by meeting ID
    this.scheduledReminders = new Map();
  }

  // Schedule reminders for a meeting (1hr, 30min, 15min, 5min before)
  scheduleReminders(meeting, user) {
    const meetingTime = new Date(meeting.scheduledFor).getTime();
    const now = Date.now();
    
    // Reminder intervals in milliseconds
    const reminderIntervals = [
      { minutes: 60, label: '1 hour' },
      { minutes: 30, label: '30 minutes' },
      { minutes: 15, label: '15 minutes' },
      { minutes: 5, label: '5 minutes' }
    ];

    const timeouts = [];

    for (const interval of reminderIntervals) {
      const reminderTime = meetingTime - (interval.minutes * 60 * 1000);
      const delay = reminderTime - now;

      // Only schedule if reminder time is in the future
      if (delay > 0) {
        const timeout = setTimeout(async () => {
          try {
            await this.sendReminder(meeting, user, interval.label);
          } catch (error) {
            console.error(`Failed to send ${interval.label} reminder:`, error);
          }
        }, delay);

        timeouts.push(timeout);
        console.log(`Scheduled ${interval.label} reminder for meeting ${meeting.meetingId} at ${new Date(reminderTime).toLocaleString()}`);
      }
    }

    // Store timeouts for potential cancellation
    this.scheduledReminders.set(meeting.meetingId, timeouts);
  }

  // Cancel all reminders for a meeting
  cancelReminders(meetingId) {
    const timeouts = this.scheduledReminders.get(meetingId);
    if (timeouts) {
      timeouts.forEach(timeout => clearTimeout(timeout));
      this.scheduledReminders.delete(meetingId);
      console.log(`Cancelled all reminders for meeting ${meetingId}`);
    }
  }


  // Send reminder email
  async sendReminder(meeting, user, timeLabel) {
    emailService.initialize();
    
    if (!emailService.transporter) {
      console.error('Email service not configured');
      return;
    }

    const meetingTime = new Date(meeting.scheduledFor);
    const joinLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/meeting/${meeting.meetingId}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0 0 10px 0; font-size: 24px;">⏰ Meeting Reminder</h1>
      <p style="margin: 0; opacity: 0.9; font-size: 18px;">Starting in ${timeLabel}</p>
    </div>
    
    <!-- Meeting Details -->
    <div style="padding: 30px;">
      <h2 style="color: #1e40af; margin-top: 0;">${meeting.title}</h2>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #64748b;">📅 Date:</td>
            <td style="padding: 8px 0; font-weight: 600;">${meetingTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">🕐 Time:</td>
            <td style="padding: 8px 0; font-weight: 600;">${meetingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">⏱️ Duration:</td>
            <td style="padding: 8px 0; font-weight: 600;">${meeting.duration} minutes</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">🔑 Meeting ID:</td>
            <td style="padding: 8px 0; font-weight: 600; font-family: monospace;">${meeting.meetingId}</td>
          </tr>
        </table>
      </div>

      ${meeting.description ? `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #475569; margin-bottom: 8px;">Description</h3>
        <p style="color: #64748b; margin: 0;">${meeting.description}</p>
      </div>
      ` : ''}

      <!-- Join Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${joinLink}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Join Meeting Now
        </a>
      </div>

      <p style="text-align: center; color: #64748b; font-size: 14px;">
        Or copy this link: <br>
        <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${joinLink}</code>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 20px 30px; background: #f8fafc; text-align: center; color: #64748b; font-size: 13px;">
      <p style="margin: 0;">This is an automated reminder from AI Meet</p>
    </div>
    
  </div>
</body>
</html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"AI Meet" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `⏰ Reminder: "${meeting.title}" starts in ${timeLabel}`,
        html: htmlContent
      });
      
      console.log(`Sent ${timeLabel} reminder to ${user.email} for meeting ${meeting.meetingId}`);
    } catch (error) {
      console.error(`Failed to send reminder email:`, error);
    }
  }
}

module.exports = new SchedulerService();
