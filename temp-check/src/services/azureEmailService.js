const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { format } = require('date-fns');

class AzureEmailService {
  constructor() {
    // Use Service Principal authentication
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
    
    // Get supervisor emails from environment
    this.supervisorEmails = (process.env.SUPERVISOR_EMAILS || 'jhouchin@banyancenters.com').split(',');
    this.fromAddress = 'jhouchin@banyancenters.com'; // Function will send as you
  }

  async sendDailySupervisorReport(analyses) {
    console.log('📧 Sending daily intelligence report to supervisors...');

    const subject = `📊 Daily Helpdesk Intelligence Report - ${format(new Date(), 'MMM dd, yyyy')}`;
    const html = this.generateSupervisorReportHTML(analyses);
    
    await this.sendEmail({
      to: this.supervisorEmails,
      subject,
      html
    });

    // Send urgent alerts if needed
    if (analyses.noResponseAlerts && analyses.noResponseAlerts.length > 0) {
      await this.send72HourAlerts(analyses.noResponseAlerts);
    }

    console.log('✅ All daily intelligence notifications sent');
  }

  async send72HourAlerts(alerts) {
    const subject = `🚨 URGENT: ${alerts.length} Tickets With No Response (72+ Hours)`;
    const html = this.generate72HourAlertHTML(alerts);
    
    await this.sendEmail({
      to: this.supervisorEmails,
      subject,
      html,
      importance: 'high'
    });
  }

  async sendErrorNotification(error, context) {
    const subject = `❌ Helpdesk Analysis Error - ${context}`;
    const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>❌ Helpdesk Analysis Error</h2>
        <p><strong>Context:</strong> ${context}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <pre style="background: #f5f5f5; padding: 10px;">${error.stack}</pre>
    </div>`;
    
    await this.sendEmail({
      to: this.supervisorEmails,
      subject,
      html,
      importance: 'high'
    });
  }

  generateSupervisorReportHTML(analyses) {
    const { summary, noResponseAlerts, stuckTickets, performanceReviews, closedTickets } = analyses;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
            .header { background: #0078d4; color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .section { margin: 20px 0; padding: 15px; border-radius: 8px; }
            .alert { background: #fff3cd; border: 1px solid #ffeaa7; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; }
            .info { background: #d1ecf1; border: 1px solid #bee5eb; }
            .warning { background: #f8d7da; border: 1px solid #f5c6cb; }
            .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
            .metric-card { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 6px; text-align: center; }
            .metric-value { font-size: 24px; font-weight: bold; color: #0078d4; }
            .ticket-list { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
            .ticket-item { padding: 8px; margin: 4px 0; background: white; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Daily Helpdesk Intelligence Report</h1>
            <p>${format(new Date(), 'EEEE, MMMM do, yyyy')} • Generated at ${format(new Date(), 'h:mm a')}</p>
        </div>

        <!-- Executive Dashboard -->
        <div class="section info">
            <h2>📈 Executive Dashboard</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${summary?.totalTickets || 0}</div>
                    <div>Total Open Tickets</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" style="color: ${(noResponseAlerts?.length || 0) > 0 ? '#dc3545' : '#0078d4'}">${noResponseAlerts?.length || 0}</div>
                    <div>72+ Hour No Response</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${stuckTickets?.length || 0}</div>
                    <div>Stuck Tickets (14+ days)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${closedTickets?.totalClosed || 0}</div>
                    <div>Closed Yesterday</div>
                </div>
            </div>
        </div>

        ${(noResponseAlerts?.length || 0) > 0 ? `
        <!-- 72-Hour No Response Alerts -->
        <div class="section warning">
            <h2>🚨 URGENT: Tickets With No Response (72+ Hours)</h2>
            <p><strong>${noResponseAlerts.length} tickets</strong> require immediate technician attention:</p>
            <div class="ticket-list">
                ${noResponseAlerts.slice(0, 10).map(alert => `
                <div class="ticket-item">
                    <strong>#${alert.ticket?.IssueID || 'N/A'}</strong> - ${alert.ticket?.Subject || 'No subject'}
                    <br>📅 Age: ${alert.daysSinceCreated || 0} business days
                    <br>👤 Assigned: ${alert.ticket?.Tech_Assigned_Clean || 'UNASSIGNED'}
                </div>
                `).join('')}
                ${noResponseAlerts.length > 10 ? `
                <div class="ticket-item">
                    <em>... and ${noResponseAlerts.length - 10} more tickets requiring attention</em>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        <!-- Stuck Ticket AI Evaluations -->
        ${(stuckTickets?.length || 0) > 0 ? `
        <div class="section alert">
            <h2>🤖 AI Ticket Evaluations (14+ Days Old)</h2>
            <p>AI recommendations for ${stuckTickets.length} stuck tickets:</p>
            
            ${stuckTickets.slice(0, 8).map(evaluation => `
            <div class="ticket-item">
                <strong>#${evaluation.ticket?.IssueID || 'N/A'}</strong> - ${evaluation.ticket?.Subject || 'No subject'}
                <br>📅 Age: ${evaluation.age || 0} business days | 👤 Tech: ${evaluation.ticket?.Tech_Assigned_Clean || 'UNASSIGNED'}
                <br>🤖 <strong>AI Recommendation:</strong> ${evaluation.recommendation?.replace(/_/g, ' ')?.toUpperCase() || 'Analysis pending'}
                ${evaluation.reasoning?.length ? `<br>💡 Reasoning: ${evaluation.reasoning.join('; ')}` : ''}
                ${evaluation.confidence ? `<br>📊 Confidence: ${Math.round(evaluation.confidence * 100)}%` : ''}
            </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <p><strong>🤖 Generated by Helpdesk AI Intelligence Engine (Claude 4 Sonnet)</strong></p>
            <p><small>Next report: ${format(new Date(Date.now() + 24*60*60*1000), 'MMM dd, yyyy')} at 6:30 AM</small></p>
        </div>
    </body>
    </html>`;
  }

  generate72HourAlertHTML(alerts) {
    return `
    <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #dc3545;">🚨 URGENT: Tickets With No Response (72+ Hours)</h2>
        <p><strong>${alerts.length} tickets</strong> require immediate attention:</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            ${alerts.map(alert => `
            <div style="padding: 10px; margin: 5px 0; background: white; border-radius: 4px; border-left: 4px solid #dc3545;">
                <strong>#${alert.IssueID}</strong> - ${alert.Subject || 'No subject'}
                <br>Age: ${Math.floor((new Date() - new Date(alert.IssueDate)) / (1000 * 60 * 60 * 24))} days
                <br>Assigned: ${alert.Tech_Assigned_Clean || 'UNASSIGNED'}
            </div>
            `).join('')}
        </div>
        <p><strong>Action Required:</strong> Please follow up on these tickets immediately.</p>
    </div>`;
  }

  async sendEmail({ to, subject, html, importance = 'normal' }) {
    try {
      // Ensure to is an array
      const recipients = Array.isArray(to) ? to : [to];
      
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: html
        },
        toRecipients: recipients.map(email => ({
          emailAddress: {
            address: email.trim()
          }
        })),
        importance: importance
      };

      await this.graphClient
        .api(`/users/${this.fromAddress}/sendMail`)
        .post({
          message: message
        });

      console.log(`📧 Email sent via Graph API: ${subject}`);
      
    } catch (error) {
      console.error(`❌ Failed to send email: ${subject}`, error);
      throw error;
    }
  }
}

module.exports = AzureEmailService;