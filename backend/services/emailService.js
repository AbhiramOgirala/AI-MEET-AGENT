const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;
    
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    this.initialized = true;
  }

  async sendMeetingMinutes(meetingMinutes, recipients) {
    this.initialize();
    
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const results = [];
    
    for (const recipient of recipients) {
      try {
        const htmlContent = this.generateEmailHTML(meetingMinutes);
        
        await this.transporter.sendMail({
          from: `"AI Meet" <${process.env.EMAIL_USER}>`,
          to: recipient.email,
          subject: `Meeting Minutes: ${meetingMinutes.title} - ${new Date(meetingMinutes.date).toLocaleDateString()}`,
          html: htmlContent
        });
        
        results.push({
          email: recipient.email,
          status: 'sent',
          sentAt: new Date()
        });
        
        console.log(`Meeting minutes sent to ${recipient.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        results.push({
          email: recipient.email,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return results;
  }

  generateEmailHTML(minutes) {
    const actionItemsHTML = minutes.actionItems?.length > 0 
      ? minutes.actionItems.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.assigneeName || 'Unassigned'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <span style="background: ${item.priority === 'high' ? '#fee2e2' : item.priority === 'medium' ? '#fef3c7' : '#d1fae5'}; 
                         color: ${item.priority === 'high' ? '#dc2626' : item.priority === 'medium' ? '#d97706' : '#059669'};
                         padding: 2px 8px; border-radius: 4px; font-size: 12px;">
              ${item.priority?.toUpperCase() || 'MEDIUM'}
            </span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.deadline ? new Date(item.deadline).toLocaleDateString() : 'TBD'}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #666;">No action items recorded</td></tr>';

    const decisionsHTML = minutes.decisions?.length > 0
      ? minutes.decisions.map(d => `
        <li style="margin-bottom: 8px;">
          <strong>${d.description}</strong>
          ${d.madeBy ? `<br><span style="color: #666; font-size: 13px;">Decided by: ${d.madeBy}</span>` : ''}
        </li>
      `).join('')
      : '<li style="color: #666;">No decisions recorded</li>';

    const discussionPointsHTML = minutes.discussionPoints?.length > 0
      ? minutes.discussionPoints.map(dp => `
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
          <h4 style="margin: 0 0 8px 0; color: #1e40af;">${dp.topic}</h4>
          <p style="margin: 0; color: #475569;">${dp.summary}</p>
          ${dp.speakers?.length > 0 ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Contributors: ${dp.speakers.join(', ')}</p>` : ''}
        </div>
      `).join('')
      : '<p style="color: #666;">No discussion points recorded</p>';

    const attendeesHTML = minutes.attendees?.map(a => `
      <span style="display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 16px; margin: 4px; font-size: 13px;">
        ${a.name} ${a.role === 'host' ? '(Host)' : ''}
      </span>
    `).join('') || 'No attendees recorded';

    const highlightsHTML = minutes.highlights?.length > 0
      ? minutes.highlights.map(h => `<li style="margin-bottom: 6px;">${h}</li>`).join('')
      : '<li style="color: #666;">No highlights recorded</li>';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0 0 10px 0; font-size: 28px;">📋 Meeting Minutes</h1>
      <h2 style="margin: 0; font-weight: normal; opacity: 0.9;">${minutes.title}</h2>
    </div>
    
    <!-- Meeting Info -->
    <div style="padding: 20px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 5px 0;"><strong>📅 Date:</strong> ${new Date(minutes.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
          <td style="padding: 5px 0;"><strong>⏱️ Duration:</strong> ${minutes.duration} minutes</td>
        </tr>
      </table>
    </div>
    
    <!-- Attendees -->
    <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="color: #1e40af; margin-top: 0;">👥 Attendees</h3>
      <div>${attendeesHTML}</div>
    </div>
    
    <!-- Summary -->
    <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="color: #1e40af; margin-top: 0;">📝 Summary</h3>
      <p style="color: #475569; background: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #2563eb;">
        ${minutes.summary || 'No summary available'}
      </p>
    </div>
    
    <!-- Discussion Points -->
    <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="color: #1e40af; margin-top: 0;">💬 Discussion Points</h3>
      ${discussionPointsHTML}
    </div>
    
    <!-- Decisions -->
    <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="color: #1e40af; margin-top: 0;">✅ Decisions Made</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${decisionsHTML}
      </ul>
    </div>
    
    <!-- Action Items -->
    <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="color: #1e40af; margin-top: 0;">🎯 Action Items</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Task</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Assignee</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Priority</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Deadline</th>
          </tr>
        </thead>
        <tbody>
          ${actionItemsHTML}
        </tbody>
      </table>
    </div>
    
    <!-- Highlights -->
    <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="color: #1e40af; margin-top: 0;">⭐ Key Highlights</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${highlightsHTML}
      </ul>
    </div>
    
    <!-- Footer -->
    <div style="padding: 20px 30px; background: #f8fafc; text-align: center; color: #64748b; font-size: 13px;">
      <p style="margin: 0;">This meeting summary was automatically generated by AI Meet</p>
      <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleString()}</p>
    </div>
    
  </div>
</body>
</html>
    `;
  }
}

module.exports = new EmailService();
