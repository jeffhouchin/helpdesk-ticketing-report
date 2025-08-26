const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');

class EmailService {
  constructor() {
    // Use same credentials as SharePoint service
    this.credential = new ClientSecretCredential(
      process.env.TENANT_ID,
      process.env.MICROSOFT_CLIENT_ID,
      process.env.MICROSOFT_CLIENT_SECRET
    );
    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await this.credential.getToken(['https://graph.microsoft.com/.default']);
          return token.token;
        }
      }
    });
    this.fromEmail = process.env.FROM_EMAIL || 'jhouchin@banyancenters.com';
  }

  async sendDailySummary(analysis) {
    const subject = `Daily Helpdesk Summary - ${new Date().toLocaleDateString()}`;
    const html = this.generateSummaryHTML(analysis);
    
    await this.sendEmail({
      to: config.analysis.managerEmail,
      subject,
      html
    });
  }

  async sendTechnicianReminder(ticket, technicianEmail) {
    const subject = `Ticket Reminder: ${ticket.title || ticket.id}`;
    const html = this.generateReminderHTML(ticket);
    
    await this.sendEmail({
      to: technicianEmail,
      subject,
      html
    });
  }

  async sendUserReminder(ticket, userEmail) {
    const subject = `Ticket Update Required: ${ticket.title || ticket.id}`;
    const html = this.generateUserReminderHTML(ticket);
    
    await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const message = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: html
          },
          toRecipients: [{
            emailAddress: {
              address: to
            }
          }]
        }
      };

      await this.graphClient
        .api(`/users/${this.fromEmail}/sendMail`)
        .post(message);
        
      console.log(`📧 Email sent successfully to ${to}: ${subject}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  generateSummaryHTML(analysis) {
    const { summary, recommendations } = analysis;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { background: #0078d4; color: white; padding: 20px; border-radius: 8px; }
            .metric-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin: 10px 0; }
            .urgent { border-left: 4px solid #dc3545; }
            .warning { border-left: 4px solid #ffc107; }
            .success { border-left: 4px solid #28a745; }
            .info { border-left: 4px solid #17a2b8; }
            .recommendation { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 5px 0; border-radius: 4px; }
            .ticket-list { background: white; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0; }
            .ticket-item { padding: 8px; border-bottom: 1px solid #eee; }
            .ticket-item:last-child { border-bottom: none; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎯 Daily Helpdesk Summary</h1>
            <p>${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
        </div>

        <h2>📊 Key Metrics</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
            <div class="metric-card info">
                <h3>📋 Total Open</h3>
                <p style="font-size: 24px; margin: 0;"><strong>${summary.totalOpen}</strong></p>
            </div>
            <div class="metric-card ${summary.overdue > 0 ? 'urgent' : 'success'}">
                <h3>⏰ Overdue</h3>
                <p style="font-size: 24px; margin: 0;"><strong>${summary.overdue}</strong></p>
            </div>
            <div class="metric-card ${summary.stale > 0 ? 'warning' : 'success'}">
                <h3>😴 Stale (${this.staleTicketDays}+ days)</h3>
                <p style="font-size: 24px; margin: 0;"><strong>${summary.stale}</strong></p>
            </div>
            <div class="metric-card ${summary.noResponse > 0 ? 'urgent' : 'success'}">
                <h3>🚨 No Tech Response</h3>
                <p style="font-size: 24px; margin: 0;"><strong>${summary.noResponse}</strong></p>
            </div>
            <div class="metric-card ${summary.quickWins > 0 ? 'success' : 'info'}">
                <h3>⚡ Quick Wins</h3>
                <p style="font-size: 24px; margin: 0;"><strong>${summary.quickWins}</strong></p>
            </div>
            <div class="metric-card ${summary.highPriority > 0 ? 'urgent' : 'success'}">
                <h3>🔥 High Priority</h3>
                <p style="font-size: 24px; margin: 0;"><strong>${summary.highPriority}</strong></p>
            </div>
        </div>

        ${recommendations.length > 0 ? `
        <h2>💡 Recommendations</h2>
        ${recommendations.map(rec => `
        <div class="recommendation">
            <strong>${this.getRecommendationIcon(rec.type)} ${rec.message}</strong>
            <br><em>Action: ${rec.action}</em>
        </div>
        `).join('')}
        ` : ''}

        ${analysis.overdueTickets.length > 0 ? `
        <h2>🚨 Overdue Tickets (Immediate Action Required)</h2>
        <div class="ticket-list">
            ${analysis.overdueTickets.slice(0, 10).map(ticket => `
            <div class="ticket-item">
                <strong>#${ticket.id}</strong> - ${ticket.title || 'No title'}
                <br>Due: ${this.formatDate(ticket.due)} | Assignee: ${ticket.assignee || 'Unassigned'}
            </div>
            `).join('')}
            ${analysis.overdueTickets.length > 10 ? `
            <div class="ticket-item">
                <em>... and ${analysis.overdueTickets.length - 10} more overdue tickets</em>
            </div>
            ` : ''}
        </div>
        ` : ''}

        ${analysis.noTechnicianResponse.length > 0 ? `
        <h2>🔴 Tickets Needing Technician Attention</h2>
        <div class="ticket-list">
            ${analysis.noTechnicianResponse.slice(0, 10).map(ticket => `
            <div class="ticket-item">
                <strong>#${ticket.id}</strong> - ${ticket.title || 'No title'}
                <br>Created: ${this.formatDate(ticket.created)} | Status: ${ticket.status || 'Unknown'}
                ${ticket.assignee ? `| Assignee: ${ticket.assignee}` : '| <strong>⚠️ UNASSIGNED</strong>'}
            </div>
            `).join('')}
            ${analysis.noTechnicianResponse.length > 10 ? `
            <div class="ticket-item">
                <em>... and ${analysis.noTechnicianResponse.length - 10} more tickets needing attention</em>
            </div>
            ` : ''}
        </div>
        ` : ''}

        ${analysis.quickWins.length > 0 ? `
        <h2>⚡ Quick Wins (Easy Customer Satisfaction Boosts)</h2>
        <div class="ticket-list">
            ${analysis.quickWins.slice(0, 5).map(ticket => `
            <div class="ticket-item">
                <strong>#${ticket.id}</strong> - ${ticket.title || 'No title'}
                <br>Assignee: ${ticket.assignee || 'Unassigned'} | Priority: ${ticket.priority || 'Normal'}
            </div>
            `).join('')}
            ${analysis.quickWins.length > 5 ? `
            <div class="ticket-item">
                <em>... and ${analysis.quickWins.length - 5} more quick wins available</em>
            </div>
            ` : ''}
        </div>
        ` : ''}

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <p><strong>📈 Health Score:</strong> 
            ${this.calculateHealthScore(summary)}% 
            ${this.getHealthEmoji(this.calculateHealthScore(summary))}
            </p>
            <p><small>Generated by Helpdesk AI Assistant at ${new Date().toLocaleString()}</small></p>
        </div>
    </body>
    </html>`;
  }

  generateReminderHTML(ticket) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { background: #ffc107; color: #333; padding: 20px; border-radius: 8px; }
            .ticket-details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>⏰ Ticket Reminder</h1>
        </div>
        
        <p>Hi there,</p>
        
        <p>This is a friendly reminder about a ticket that needs your attention:</p>
        
        <div class="ticket-details">
            <h3>Ticket #${ticket.id}</h3>
            <p><strong>Title:</strong> ${ticket.title || 'No title provided'}</p>
            <p><strong>Requester:</strong> ${ticket.requester || 'Unknown'}</p>
            <p><strong>Created:</strong> ${this.formatDate(ticket.created)}</p>
            <p><strong>Status:</strong> ${ticket.status || 'Unknown'}</p>
            ${ticket.due ? `<p><strong>Due Date:</strong> ${this.formatDate(ticket.due)}</p>` : ''}
            ${ticket.priority ? `<p><strong>Priority:</strong> ${ticket.priority}</p>` : ''}
        </div>
        
        <p>Please review and update this ticket when you have a moment.</p>
        
        <p>Thanks!<br>Helpdesk AI Assistant</p>
    </body>
    </html>`;
  }

  generateUserReminderHTML(ticket) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { background: #17a2b8; color: white; padding: 20px; border-radius: 8px; }
            .ticket-details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📋 Ticket Update</h1>
        </div>
        
        <p>Hello,</p>
        
        <p>We wanted to follow up on your support ticket:</p>
        
        <div class="ticket-details">
            <h3>Ticket #${ticket.id}</h3>
            <p><strong>Title:</strong> ${ticket.title || 'No title provided'}</p>
            <p><strong>Status:</strong> ${ticket.status || 'In Progress'}</p>
            <p><strong>Last Updated:</strong> ${this.formatDate(ticket.updated || ticket.created)}</p>
        </div>
        
        <p>If you have any additional information or questions about this ticket, please don't hesitate to reach out.</p>
        
        <p>Best regards,<br>IT Support Team</p>
    </body>
    </html>`;
  }

  getRecommendationIcon(type) {
    const icons = {
      urgent: '🚨',
      critical: '🔥',
      attention: '⚠️',
      opportunity: '⚡'
    };
    return icons[type] || '💡';
  }

  calculateHealthScore(summary) {
    if (summary.totalOpen === 0) return 100;
    
    let score = 100;
    score -= (summary.overdue / summary.totalOpen) * 40; // Overdue tickets heavily penalized
    score -= (summary.stale / summary.totalOpen) * 20;   // Stale tickets penalized
    score -= (summary.noResponse / summary.totalOpen) * 30; // No response heavily penalized
    score += Math.min((summary.quickWins / summary.totalOpen) * 10, 10); // Quick wins bonus
    
    return Math.max(0, Math.round(score));
  }

  getHealthEmoji(score) {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
  }

  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

module.exports = EmailService;