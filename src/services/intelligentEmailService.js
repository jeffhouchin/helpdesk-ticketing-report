const nodemailer = require('nodemailer');
const { format } = require('date-fns');
const config = require('../config');

class IntelligentEmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter(config.email.smtp);
    this.supervisorEmail = process.env.SUPERVISOR_EMAIL || 'jhouchin@banyancenters.com';
  }

  async sendDailyIntelligenceReport(analyses) {
    console.log('📧 Sending daily intelligence report...');

    // Send supervisor overview
    await this.sendSupervisorReport(analyses);

    // Send individual performance reviews
    await this.sendPerformanceReviews(analyses.performanceReviews);

    // Send 72-hour alerts if any
    if (analyses.noResponseAlerts.length > 0) {
      await this.send72HourAlerts(analyses.noResponseAlerts);
    }

    console.log('✅ All daily intelligence notifications sent');
  }

  async sendSupervisorReport(analyses) {
    const subject = `📊 Daily Helpdesk Intelligence Report - ${format(new Date(), 'MMM dd, yyyy')}`;
    const html = this.generateSupervisorReportHTML(analyses);
    
    await this.sendEmail({
      to: this.supervisorEmail,
      subject,
      html
    });
  }

  async sendPerformanceReviews(reviews) {
    console.log(`📧 Sending ${reviews.length} individual performance reviews...`);
    
    for (const review of reviews) {
      try {
        const techEmail = await this.getTechnicianEmail(review.technician);
        if (techEmail) {
          await this.sendIndividualPerformanceReview(review, techEmail);
        }
      } catch (error) {
        console.error(`Failed to send review to ${review.technician}:`, error);
      }
    }
  }

  async send72HourAlerts(alerts) {
    const subject = `🚨 URGENT: ${alerts.length} Tickets With No Response (72+ Hours)`;
    const html = this.generate72HourAlertHTML(alerts);
    
    await this.sendEmail({
      to: this.supervisorEmail,
      subject,
      html,
      priority: 'high'
    });
  }

  generateSupervisorReportHTML(analyses) {
    const { dailyOverview, noResponseAlerts, stuckTicketEvaluations, performanceReviews, closedTicketAnalysis } = analyses;
    
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
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
            .ticket-list { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
            .ticket-item { padding: 8px; margin: 4px 0; background: white; border-radius: 4px; }
            .grade-A { color: #28a745; font-weight: bold; }
            .grade-B { color: #17a2b8; font-weight: bold; }
            .grade-C { color: #ffc107; font-weight: bold; }
            .grade-D { color: #fd7e14; font-weight: bold; }
            .grade-F { color: #dc3545; font-weight: bold; }
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
                    <div class="metric-value">${dailyOverview.totalOpen}</div>
                    <div>Total Open Tickets</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value ${noResponseAlerts.length > 0 ? 'text-danger' : ''}">${noResponseAlerts.length}</div>
                    <div>72+ Hour No Response</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${stuckTicketEvaluations.length}</div>
                    <div>Stuck Tickets (14+ days)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${closedTicketAnalysis.totalClosed}</div>
                    <div>Closed Yesterday</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${dailyOverview.unassigned}</div>
                    <div>Unassigned Tickets</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${closedTicketAnalysis.avgResolutionTime}</div>
                    <div>Avg Resolution (days)</div>
                </div>
            </div>
        </div>

        ${noResponseAlerts.length > 0 ? `
        <!-- 72-Hour No Response Alerts -->
        <div class="section warning">
            <h2>🚨 URGENT: Tickets With No Response (72+ Hours)</h2>
            <p><strong>${noResponseAlerts.length} tickets</strong> require immediate technician attention:</p>
            <div class="ticket-list">
                ${noResponseAlerts.slice(0, 10).map(alert => `
                <div class="ticket-item">
                    <strong>#${alert.ticket.IssueID}</strong> - ${alert.ticket.Subject || 'No subject'}
                    <br>📅 Age: ${alert.daysSinceCreated} business days
                    <br>👤 Assigned: ${alert.ticket.Tech_Assigned_Clean || 'UNASSIGNED'}
                    <br>🎯 Action: ${alert.recommendedAction}
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
        ${stuckTicketEvaluations.length > 0 ? `
        <div class="section alert">
            <h2>🤖 AI Ticket Evaluations (14+ Days Old)</h2>
            <p>AI recommendations for ${stuckTicketEvaluations.length} stuck tickets:</p>
            
            ${stuckTicketEvaluations.slice(0, 8).map(eval => `
            <div class="ticket-item">
                <strong>#${eval.ticket.IssueID}</strong> - ${eval.ticket.Subject || 'No subject'}
                <br>📅 Age: ${eval.age} business days | 👤 Tech: ${eval.ticket.Tech_Assigned_Clean}
                <br>🤖 <strong>AI Recommendation:</strong> ${eval.recommendation.replace(/_/g, ' ').toUpperCase()}
                <br>💡 Reasoning: ${eval.reasoning.join('; ')}
                <br>📊 Confidence: ${Math.round(eval.confidence * 100)}%
            </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Performance Review Summary -->
        <div class="section info">
            <h2>🎯 Daily Performance Reviews</h2>
            <p>Random sample of ${performanceReviews.length} tickets reviewed (10% of open tickets):</p>
            
            <table>
                <thead>
                    <tr>
                        <th>Technician</th>
                        <th>Ticket</th>
                        <th>Grade</th>
                        <th>Key Issues</th>
                    </tr>
                </thead>
                <tbody>
                    ${performanceReviews.map(review => `
                    <tr>
                        <td>${review.technician}</td>
                        <td>#${review.ticket.IssueID}</td>
                        <td><span class="grade-${review.grade}">${review.grade} (${review.score}%)</span></td>
                        <td>${review.weaknesses.length > 0 ? review.weaknesses[0] : 'Good performance'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Technician Workload -->
        <div class="section">
            <h2>👥 Current Workload Distribution</h2>
            <table>
                <thead>
                    <tr><th>Technician</th><th>Open Tickets</th><th>Yesterday's Completions</th><th>Avg Quality</th></tr>
                </thead>
                <tbody>
                    ${Object.entries(dailyOverview.technicianWorkload)
                      .sort(([,a], [,b]) => b - a)
                      .map(([tech, count]) => {
                        const perf = closedTicketAnalysis.technicianPerformance[tech];
                        return `
                        <tr>
                            <td>${tech}</td>
                            <td>${count}</td>
                            <td>${perf ? perf.ticketsCompleted : 0}</td>
                            <td>${perf ? perf.qualityScore + '%' : 'N/A'}</td>
                        </tr>
                        `;
                      }).join('')}
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <p><strong>🤖 Generated by Helpdesk AI Intelligence Engine</strong></p>
            <p><small>Next report: ${format(new Date(Date.now() + 24*60*60*1000), 'MMM dd, yyyy')} at 6:30 AM</small></p>
        </div>
    </body>
    </html>`;
  }

  async sendIndividualPerformanceReview(review, techEmail) {
    const subject = `📋 Your Daily Performance Review - Ticket #${review.ticket.IssueID}`;
    const html = this.generatePerformanceReviewHTML(review);
    
    await this.sendEmail({
      to: techEmail,
      cc: this.supervisorEmail,
      subject,
      html
    });
  }

  generatePerformanceReviewHTML(review) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { background: #0078d4; color: white; padding: 20px; border-radius: 8px; }
            .grade { font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; }
            .grade-A { color: #28a745; }
            .grade-B { color: #17a2b8; }
            .grade-C { color: #ffc107; }
            .grade-D { color: #fd7e14; }
            .grade-F { color: #dc3545; }
            .section { margin: 20px 0; padding: 15px; border-radius: 8px; }
            .strengths { background: #d4edda; border: 1px solid #c3e6cb; }
            .weaknesses { background: #f8d7da; border: 1px solid #f5c6cb; }
            .ticket-details { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📋 Daily Performance Review</h1>
            <p>Ticket #${review.ticket.IssueID} | ${format(new Date(), 'MMM dd, yyyy')}</p>
        </div>

        <div class="grade grade-${review.grade}">
            Grade: ${review.grade} (${review.score}%)
        </div>

        <div class="ticket-details">
            <h3>Ticket Details</h3>
            <p><strong>Subject:</strong> ${review.ticket.Subject || 'No subject'}</p>
            <p><strong>Created:</strong> ${review.ticket.IssueDate ? format(review.ticket.IssueDate, 'MMM dd, yyyy') : 'Unknown'}</p>
            <p><strong>Age:</strong> ${review.metrics.age} business days</p>
            <p><strong>Status:</strong> ${review.ticket.Current_Status || 'Unknown'}</p>
            <p><strong>Your Responses:</strong> ${review.metrics.responseCount}</p>
        </div>

        ${review.strengths.length > 0 ? `
        <div class="section strengths">
            <h3>✅ Strengths</h3>
            <ul>
                ${review.strengths.map(strength => `<li>${strength}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${review.weaknesses.length > 0 ? `
        <div class="section weaknesses">
            <h3>⚠️ Areas for Improvement</h3>
            <ul>
                ${review.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        ${review.recommendations.length > 0 ? `
        <div class="section">
            <h3>💡 Recommendations</h3>
            <ul>
                ${review.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
            <p><strong>This is an automated performance review based on ticket analysis.</strong></p>
            <p>Questions? Contact your supervisor or reply to this email.</p>
            <p><small>Generated by Helpdesk AI at ${format(new Date(), 'h:mm a')}</small></p>
        </div>
    </body>
    </html>`;
  }

  async getTechnicianEmail(techUsername) {
    // This would map technician usernames to email addresses
    // For now, use a simple mapping or configuration
    const techEmailMap = {
      'BHOPB\\rmoll': 'rmoll@banyancenters.com',
      'bhopb\\rvoyer': 'rvoyer@banyancenters.com',
      'BHOPB\\dmui': 'dmui@banyancenters.com',
      // Add more mappings as needed
    };
    
    return techEmailMap[techUsername] || null;
  }

  async sendEmail({ to, cc, subject, html, priority = 'normal' }) {
    try {
      const mailOptions = {
        from: `"${config.email.from.name}" <${config.email.from.email}>`,
        to,
        cc,
        subject,
        html,
        priority: priority === 'high' ? 'high' : 'normal'
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent: ${subject}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send email: ${subject}`, error);
      throw error;
    }
  }
}

module.exports = IntelligentEmailService;