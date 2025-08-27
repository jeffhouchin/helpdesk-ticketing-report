// Email Dispatcher Module - Clean, single email service for executive communications
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');

class EmailDispatcher {
  constructor() {
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
    
    this.fromAddress = process.env.FROM_EMAIL || 'jhouchin@banyancenters.com';
    this.supervisorEmails = (process.env.SUPERVISOR_EMAIL || 'jhouchin@banyancenters.com,rmoll@banyancenters.com,cbowra@banyancenters.com').split(',').map(e => e.trim());
  }

  async sendExecutiveDashboard(htmlContent, subject) {
    console.log('📧 Sending executive dashboard email...');
    
    try {
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlContent
        },
        toRecipients: this.supervisorEmails.map(email => ({
          emailAddress: {
            address: email
          }
        })),
        importance: 'normal'
      };

      await this.graphClient
        .api(`/users/${this.fromAddress}/sendMail`)
        .post({ message });

      console.log(`✅ Executive dashboard sent to: ${this.supervisorEmails.join(', ')}`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to send executive dashboard:`, error);
      throw error;
    }
  }

  async sendSupervisorDashboard(supervisorReport, subject) {
    console.log('📧 Sending supervisor dashboard email...');
    
    try {
      const htmlContent = this.generateSupervisorHTML(supervisorReport);
      
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlContent
        },
        toRecipients: this.supervisorEmails.map(email => ({
          emailAddress: {
            address: email
          }
        })),
        importance: 'normal'
      };

      await this.graphClient
        .api(`/users/${this.fromAddress}/sendMail`)
        .post({ message });

      console.log(`✅ Supervisor dashboard sent to: ${this.supervisorEmails.join(', ')}`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to send supervisor dashboard:`, error);
      throw error;
    }
  }

  async sendEmail(recipientEmail, subject, htmlContent) {
    console.log(`📧 Sending email to ${recipientEmail}...`);
    
    try {
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlContent
        },
        toRecipients: [{
          emailAddress: {
            address: recipientEmail
          }
        }],
        importance: 'normal'
      };

      await this.graphClient
        .api(`/users/${this.fromAddress}/sendMail`)
        .post({ message });

      console.log(`✅ Email sent successfully to: ${recipientEmail}`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to send email to ${recipientEmail}:`, error);
      throw error;
    }
  }

  async sendUrgentAlert(alertContent, alertCount) {
    console.log(`🚨 Sending urgent alert for ${alertCount} tickets...`);
    
    const subject = `🚨 URGENT: ${alertCount} Tickets Require Immediate Attention`;
    
    try {
      const message = {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: alertContent
        },
        toRecipients: this.supervisorEmails.map(email => ({
          emailAddress: {
            address: email
          }
        })),
        importance: 'high'
      };

      await this.graphClient
        .api(`/users/${this.fromAddress}/sendMail`)
        .post({ message });

      console.log(`✅ Urgent alert sent successfully`);
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Failed to send urgent alert:`, error);
      throw error;
    }
  }

  async sendErrorNotification(error, context) {
    console.log(`❌ Sending error notification...`);
    
    const subject = `❌ IT Dashboard System Error - ${context}`;
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <h1>❌ System Error Alert</h1>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0;">
            <h3>Error Details:</h3>
            <p><strong>Context:</strong> ${context}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Message:</strong> ${error.message}</p>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #666;">
            <p>This is an automated alert from the IT Dashboard System.</p>
            <p>Please investigate and resolve the issue promptly.</p>
        </div>
    </div>`;
    
    try {
      await this.sendExecutiveDashboard(html, subject);
      console.log(`✅ Error notification sent`);
    } catch (emailError) {
      console.error(`❌ Failed to send error notification:`, emailError);
    }
  }

  generateSupervisorHTML(supervisorReport) {
    // Handle both old and new dashboard formats
    if (supervisorReport.type === 'actionable_supervisor_dashboard') {
      return this.generateActionableDashboardHTML(supervisorReport);
    }
    
    // Legacy format
    const analysis = supervisorReport.analysis;
    const summary = supervisorReport.summary;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style type="text/css">
            body { font-family: Arial, sans-serif !important; margin: 0; padding: 10px; background-color: #ffffff; color: #000000; }
            .container { width: 100%; max-width: 800px; margin: 0 auto; background-color: #ffffff; border: 2px solid #000000; }
            .header { background-color: #1e3a5f; color: #ffffff; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; color: #ffffff; }
            .header p { margin: 10px 0 0 0; color: #ffffff; font-size: 14px; }
            .summary-table { width: 100%; border-collapse: collapse; }
            .summary-table td { padding: 15px; text-align: center; border: 1px solid #333333; background-color: #ffffff; }
            .summary-value { font-size: 28px; font-weight: bold; color: #000000; display: block; }
            .summary-label { font-size: 12px; color: #333333; text-transform: uppercase; font-weight: bold; display: block; margin-top: 5px; }
            .section { padding: 20px; border-top: 2px solid #cccccc; background-color: #ffffff; }
            .section h2 { color: #000000; margin: 0 0 10px 0; font-size: 18px; font-weight: bold; border-bottom: 2px solid #1e3a5f; padding-bottom: 5px; }
            .priority-high { color: #cc0000; font-weight: bold; }
            .priority-medium { color: #ff6600; font-weight: bold; }
            .priority-critical { color: #ffffff; background-color: #cc0000; padding: 3px 8px; font-weight: bold; display: inline-block; }
            .tech-name { font-weight: bold; color: #0044cc; }
            .ticket-id { font-family: 'Courier New', monospace; background-color: #eeeeee; padding: 2px 6px; border: 1px solid #666666; font-weight: bold; color: #000000; display: inline-block; }
            .footer { padding: 15px; text-align: center; background-color: #eeeeee; color: #000000; font-size: 11px; border-top: 2px solid #000000; }
            ul { margin: 10px 0; padding-left: 20px; color: #000000; }
            li { margin: 8px 0; line-height: 1.5; color: #000000; }
            .status-tag { background-color: #008800; color: #ffffff; padding: 2px 6px; font-size: 11px; margin-left: 10px; font-weight: bold; display: inline-block; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; border: 2px solid #000000; }
            th { background-color: #1e3a5f; padding: 10px; text-align: left; border: 1px solid #000000; font-weight: bold; color: #ffffff; }
            td { padding: 8px 10px; border: 1px solid #666666; color: #000000; background-color: #ffffff; }
            .violation-critical { background-color: #ffcccc !important; }
            .violation-high { background-color: #ffe6cc !important; }
            small { display: block; margin-top: 3px; color: #333333; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header" id="top">
                <h1>📋 Daily Helpdesk Supervisor Dashboard</h1>
                <p>${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString()}</p>
                <p style="margin-top: 10px; font-size: 12px; color: #ffffff;">Click any metric below to jump directly to that section</p>
            </div>
            
            <table class="summary-table" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                <tr>
                    <td style="padding: 15px; text-align: center; border: 1px solid #333333; background-color: #ffffff;">
                        <span class="summary-value">${summary.totalOpen}</span>
                        <span class="summary-label">Total Open Tickets</span>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: #f0f0f0;">
                        <a href="#priorities" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: #cc0000; display: block;">${summary.criticalActions}</span>
                            <span class="summary-label" style="color: #333333; display: block;">Critical Actions ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: #ffffff;">
                        <a href="#sla-risks" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: #ff6600; display: block;">${summary.slaRisks}</span>
                            <span class="summary-label" style="color: #333333; display: block;">SLA Risks ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: #f0f0f0;">
                        <a href="#team-coaching" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="${summary.teamIssues > 0 ? 'color: #ff6600;' : 'color: #000000;'} display: block;">${summary.teamIssues}</span>
                            <span class="summary-label" style="color: #333333; display: block;">Team Coaching ↓</span>
                        </a>
                    </td>
                </tr>
            </table>
            
            ${analysis.daily_priorities && analysis.daily_priorities.length > 0 ? `
            <div class="section" id="priorities">
                <h2>🎯 Immediate Action Items (Priority Order)</h2>
                <ul>
                ${analysis.daily_priorities.map(item => `
                    <li>
                        <span class="priority-${item.priority.toLowerCase()}">${item.priority}</span>: 
                        ${item.action}
                        ${item.assigned_tech !== 'UNASSIGNED' ? `<span class="tech-name">[${item.assigned_tech}]</span>` : '<strong>[UNASSIGNED]</strong>'}
                        <br><small>${item.why}</small>
                        ${item.tickets && item.tickets.length > 0 ? `<br><small>Tickets: ${item.tickets.map(t => `<span class="ticket-id">#${t}</span>`).join(', ')}</small>` : ''}
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${analysis.sla_risks && analysis.sla_risks.length > 0 ? `
            <div class="section" id="sla-risks">
                <h2>⚠️ SLA Risk Assessment</h2>
                <ul>
                ${analysis.sla_risks.map(risk => `
                    <li>
                        <span class="ticket-id">#${risk.ticket_id}</span> - 
                        <span class="priority-${risk.risk_level.toLowerCase()}">${risk.risk_level} RISK</span>
                        (${risk.days_to_breach} days to breach)
                        <br><small><strong>Recommended:</strong> ${risk.recommended_action}</small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${analysis.team_coaching && analysis.team_coaching.length > 0 ? `
            <div class="section" id="team-coaching">
                <h2>👥 Team Coaching Opportunities</h2>
                <ul>
                ${analysis.team_coaching.map(coaching => `
                    <li>
                        <span class="tech-name">${coaching.tech_name}</span>: ${coaching.issue}
                        <br><small><strong>Coaching Action:</strong> ${coaching.coaching_action}</small>
                        ${coaching.tickets && coaching.tickets.length > 0 ? `<br><small>Example tickets: ${coaching.tickets.map(t => `<span class="ticket-id">#${t}</span>`).join(', ')}</small>` : ''}
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${analysis.positive_highlights && analysis.positive_highlights.length > 0 ? `
            <div class="section">
                <h2>🌟 Team Highlights</h2>
                <ul>
                ${analysis.positive_highlights.map(highlight => `
                    <li>
                        <span class="tech-name">${highlight.tech_name}</span>: ${highlight.achievement}
                        <br><small><strong>Impact:</strong> ${highlight.impact}</small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${analysis.system_recommendations && analysis.system_recommendations.length > 0 ? `
            <div class="section">
                <h2>⚙️ Process Improvements</h2>
                <ul>
                ${analysis.system_recommendations.map(rec => `
                    <li>
                        <strong>Issue:</strong> ${rec.issue}
                        <br><small><strong>Impact:</strong> ${rec.impact}</small>
                        <br><small><strong>Suggested Fix:</strong> ${rec.suggested_fix}</small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="footer">
                <p>Generated by Helpdesk Dashboard System • Next update: ${new Date(Date.now() + 24*60*60*1000).toLocaleDateString()} at 6:30 AM</p>
                <p>Focus: Actionable insights for team management and SLA compliance</p>
            </div>
        </div>
    </body>
    </html>`;
  }

  generateActionableDashboardHTML(supervisorReport) {
    const summary = supervisorReport.summary;
    const sections = supervisorReport.sections;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style type="text/css">
            body { font-family: Arial, sans-serif !important; margin: 0; padding: 10px; background-color: #ffffff; color: #000000; }
            .container { width: 100%; max-width: 800px; margin: 0 auto; background-color: #ffffff; border: 2px solid #000000; }
            .header { background-color: #1e3a5f; color: #ffffff; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; color: #ffffff; }
            .header p { margin: 10px 0 0 0; color: #ffffff; font-size: 14px; }
            .summary-table { width: 100%; border-collapse: collapse; }
            .summary-table td { padding: 15px; text-align: center; border: 1px solid #333333; background-color: #ffffff; }
            .summary-value { font-size: 28px; font-weight: bold; color: #000000; display: block; }
            .summary-label { font-size: 12px; color: #333333; text-transform: uppercase; font-weight: bold; display: block; margin-top: 5px; }
            .section { padding: 20px; border-top: 2px solid #cccccc; background-color: #ffffff; }
            .section h2 { color: #000000; margin: 0 0 10px 0; font-size: 18px; font-weight: bold; border-bottom: 2px solid #1e3a5f; padding-bottom: 5px; }
            .section h2 .emoji { margin-right: 8px; display: inline; }
            .critical { color: #ffffff; background-color: #cc0000; padding: 3px 8px; font-weight: bold; display: inline-block; }
            .high { color: #cc0000; font-weight: bold; }
            .medium { color: #ff6600; font-weight: bold; }
            .ticket-link { font-family: 'Courier New', monospace; background-color: #eeeeee; padding: 4px 8px; text-decoration: none; color: #0044cc; border: 1px solid #666666; font-weight: bold; }
            .ticket-link:hover { background-color: #dddddd; }
            .tech-name { font-weight: bold; color: #0044cc; }
            .aging-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .aging-bucket { padding: 15px; text-align: center; border: 2px solid #666666; background-color: #ffffff; }
            .aging-bucket.critical { border-color: #cc0000; background-color: #ffcccc; }
            .aging-bucket.concern { border-color: #ff6600; background-color: #ffe6cc; }
            .bucket-count { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .bucket-label { font-size: 12px; color: #333333; font-weight: bold; }
            ul { margin: 10px 0; padding-left: 20px; color: #000000; }
            li { margin: 8px 0; line-height: 1.5; color: #000000; }
            .perf-table { width: 100%; border-collapse: collapse; }
            .perf-card { background-color: #f0f0f0; padding: 15px; border-left: 4px solid #0044cc; border: 1px solid #333333; }
            .footer { padding: 15px; text-align: center; background-color: #eeeeee; color: #000000; font-size: 11px; border-top: 2px solid #000000; }
            .status-badge { background-color: #0044cc; color: #ffffff; padding: 2px 8px; font-size: 11px; margin-left: 10px; font-weight: bold; display: inline-block; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; border: 2px solid #000000; }
            th { background-color: #1e3a5f; padding: 10px; text-align: left; border: 1px solid #000000; font-weight: bold; color: #ffffff; }
            td { padding: 8px 10px; border: 1px solid #666666; color: #000000; background-color: #ffffff; }
            tr:hover { background-color: #f0f0f0; }
            .violation-row-critical { background-color: #ffcccc !important; }
            .violation-row-high { background-color: #ffe6cc !important; }
            small { display: block; margin-top: 3px; color: #333333; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header" id="top">
                <h1>⚡ Actionable Supervisor Dashboard</h1>
                <p>${new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'})} • ${new Date().toLocaleTimeString('en-US', {timeZone: 'America/New_York'})} EST</p>
                <p style="margin-top: 10px; font-size: 12px;">Click any metric below to jump to that section</p>
            </div>
            
            <table class="summary-table" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                <tr>
                    <td style="padding: 15px; text-align: center; border: 1px solid #333333; background-color: #ffffff;">
                        <span class="summary-value">${summary.totalOpen}</span>
                        <span class="summary-label">Total Open</span>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: #ffcccc;">
                        <a href="#sla-violations" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: #cc0000; font-weight: bold; display: block;">${summary.slaViolations}</span>
                            <span class="summary-label" style="color: #333333; display: block;">SLA Violations ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: ${summary.noTechResponse3Days > 50 ? '#ffcccc' : summary.noTechResponse3Days > 20 ? '#ffe6cc' : '#ffffff'};">
                        <a href="#no-response" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: ${summary.noTechResponse3Days > 50 ? '#cc0000' : summary.noTechResponse3Days > 20 ? '#cc0000' : '#ff6600'}; display: block;">${summary.noTechResponse3Days}</span>
                            <span class="summary-label" style="color: #333333; display: block;">No Response 3+ Days ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: ${summary.criticalAging > 20 ? '#ffcccc' : summary.criticalAging > 10 ? '#ffe6cc' : '#ffffff'};">
                        <a href="#aging" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: ${summary.criticalAging > 20 ? '#cc0000' : summary.criticalAging > 10 ? '#cc0000' : '#000000'}; display: block;">${summary.criticalAging}</span>
                            <span class="summary-label" style="color: #333333; display: block;">Critical Aging ↓</span>
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 0; border: 1px solid #333333; background-color: ${summary.immediateTriage > 0 ? '#ffe6cc' : '#ffffff'};">
                        <a href="#triage" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: ${summary.immediateTriage > 0 ? '#cc0000' : '#000000'}; display: block;">${summary.immediateTriage}</span>
                            <span class="summary-label" style="color: #333333; display: block;">Immediate Triage ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: ${summary.vipAlerts > 0 ? '#ffcccc' : '#ffffff'};">
                        <a href="#vip" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: ${summary.vipAlerts > 0 ? '#cc0000' : '#000000'}; font-weight: bold; display: block;">${summary.vipAlerts}</span>
                            <span class="summary-label" style="color: #333333; display: block;">VIP Alerts ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: ${summary.quickWins > 0 ? '#e6ffe6' : '#ffffff'};">
                        <a href="#quickwins" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: ${summary.quickWins > 0 ? '#006600' : '#000000'}; display: block;">${summary.quickWins}</span>
                            <span class="summary-label" style="color: #333333; display: block;">Quick Wins ↓</span>
                        </a>
                    </td>
                    <td style="padding: 0; border: 1px solid #333333; background-color: #ffffff;">
                        <a href="#closure" style="display: block; padding: 15px; text-align: center; text-decoration: none; color: inherit;">
                            <span class="summary-value" style="color: #000000; display: block;">${summary.closureCandidates}</span>
                            <span class="summary-label" style="color: #333333; display: block;">Ready to Close ↓</span>
                        </a>
                    </td>
                </tr>
            </table>
            
            ${sections.sla_violations && sections.sla_violations.length > 0 ? `
            <div class="section" id="sla-violations">
                <h2><span class="emoji">🚨</span>SLA Violations - Immediate Action Required</h2>
                <ul>
                ${sections.sla_violations.slice(0, 10).map(violation => `
                    <li>
                        <a href="${violation.url}" class="ticket-link">#${violation.ticketId}</a> - 
                        <span class="${violation.severity.toLowerCase()}">${violation.severity}</span>
                        <strong>${violation.type.replace('_', ' ')}</strong>
                        <br><small>${violation.message}</small>
                        <br><small><strong>Action:</strong> ${violation.action.replace('_', ' ')}</small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${sections.no_tech_response_3days && sections.no_tech_response_3days.length > 0 ? `
            <div class="section" id="no-response">
                <h2><span class="emoji">⏰</span>3+ Days No Tech Response - Priority Follow-Up Required</h2>
                <ul>
                ${sections.no_tech_response_3days.slice(0, 15).map(ticket => `
                    <li>
                        <a href="${ticket.url}" class="ticket-link">#${ticket.ticketId}</a> - 
                        <span class="${ticket.priority.toLowerCase()}">${ticket.priority}</span>
                        (Created ${ticket.daysSinceCreated} days ago)
                        <br><small><strong>Subject:</strong> ${ticket.subject}</small>
                        <br><small><strong>Assigned:</strong> <span class="tech-name">${ticket.assigned}</span></small>
                        <br><small><strong>Last Tech Response:</strong> ${ticket.daysSinceLastTechResponse === ticket.daysSinceCreated ? 'NEVER' : `${ticket.daysSinceLastTechResponse} days ago`}</small>
                    </li>
                `).join('')}
                </ul>
                ${sections.no_tech_response_3days.length > 15 ? `<p><em>+ ${sections.no_tech_response_3days.length - 15} more tickets requiring tech response...</em></p>` : ''}
            </div>
            ` : ''}
            
            ${sections.aging_analysis ? `
            <div class="section" id="aging">
                <h2><span class="emoji">📊</span>Ticket Aging Analysis</h2>
                <table class="aging-table" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="padding: 15px; text-align: center; border: 2px solid #666666; background-color: #ffffff;">
                            <div style="font-size: 24px; font-weight: bold; color: #000000;">${sections.aging_analysis.buckets['0-3_days'].length}</div>
                            <div style="font-size: 12px; color: #333333; font-weight: bold;">0-3 Days<br>Fresh</div>
                        </td>
                        <td style="padding: 15px; text-align: center; border: 2px solid #666666; background-color: #ffffff;">
                            <div style="font-size: 24px; font-weight: bold; color: #000000;">${sections.aging_analysis.buckets['4-7_days'].length}</div>
                            <div style="font-size: 12px; color: #333333; font-weight: bold;">4-7 Days<br>Normal</div>
                        </td>
                        <td style="padding: 15px; text-align: center; border: 2px solid #666666; background-color: #ffffff;">
                            <div style="font-size: 24px; font-weight: bold; color: #000000;">${sections.aging_analysis.buckets['8-14_days'].length}</div>
                            <div style="font-size: 12px; color: #333333; font-weight: bold;">8-14 Days<br>Watch</div>
                        </td>
                        <td style="padding: 15px; text-align: center; border: 2px solid #ff6600; background-color: #ffe6cc;">
                            <div style="font-size: 24px; font-weight: bold; color: #ff6600;">${sections.aging_analysis.buckets['15-21_days'].length}</div>
                            <div style="font-size: 12px; color: #333333; font-weight: bold;">15-21 Days<br>Manager Review</div>
                        </td>
                        <td style="padding: 15px; text-align: center; border: 2px solid #cc0000; background-color: #ffcccc;">
                            <div style="font-size: 24px; font-weight: bold; color: #cc0000;">${sections.aging_analysis.buckets['22+_days'].length}</div>
                            <div style="font-size: 12px; color: #333333; font-weight: bold;">22+ Days<br>Escalate</div>
                        </td>
                    </tr>
                </table>
            </div>
            ` : ''}
            
            ${sections.immediate_triage && sections.immediate_triage.length > 0 ? `
            <div class="section" id="triage">
                <h2><span class="emoji">⚡</span>Immediate Triage - New Tickets Needing Assignment</h2>
                <ul>
                ${sections.immediate_triage.map(item => `
                    <li>
                        <a href="${item.url}" class="ticket-link">#${item.ticketId}</a> - 
                        <span class="${item.priority.toLowerCase()}">${item.priority}</span>
                        (${item.age})
                        <br><small><strong>Subject:</strong> ${item.subject}</small>
                        <br><small><strong>Reason:</strong> ${item.reason}</small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${sections.vip_alerts && sections.vip_alerts.length > 0 ? `
            <div class="section" id="vip">
                <h2><span class="emoji">👑</span>VIP Alerts - Executive/Director Tickets</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #cc0000; margin-top: 15px;">
                    <tr>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000;">Ticket</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000;">VIP Indicator</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000;">Submitter</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000;">Subject</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: center; border: 1px solid #000000;">Age</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000;">Assigned To</th>
                    </tr>
                ${sections.vip_alerts.map((vip, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffcccc' : '#ffe6e6'};">
                        <td style="padding: 8px; border: 1px solid #666666;">
                            <a href="${vip.url}" style="color: #cc0000; font-weight: bold; text-decoration: underline;">#${vip.ticketId}</a>
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; font-weight: bold; color: #cc0000;">
                            ${vip.vipReason || 'VIP'}<br>
                            <span style="font-size: 11px; font-weight: normal; color: #666666;">(${vip.vipTerm || 'executive'})</span>
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; color: #000000;">
                            <strong>${vip.submitter}</strong>
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; color: #000000; font-size: 12px;">
                            ${vip.subject}
                        </td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; color: ${vip.age > 3 ? '#cc0000' : '#000000'}; font-weight: bold;">
                            ${vip.age} days
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; color: ${vip.assigned === 'UNASSIGNED' ? '#cc0000' : '#0044cc'}; font-weight: bold;">
                            ${vip.assigned}
                        </td>
                    </tr>
                `).join('')}
                </table>
                <p style="margin-top: 10px; font-size: 12px; color: #cc0000; font-weight: bold;">⚠️ VIP Detection: Matches keywords (director, vp, president, ceo, cfo, cto, executive) in submitter name, subject, or ticket body</p>
            </div>
            ` : ''}
            
            ${sections.quick_wins && sections.quick_wins.length > 0 ? `
            <div class="section" id="quickwins">
                <h2><span class="emoji">🎯</span>Quick Wins - Easy Resolutions (~${sections.quick_wins.reduce((sum, qw) => sum + (qw.estimatedMinutes || 20), 0)} min total)</h2>
                <ul>
                ${sections.quick_wins.map(qw => `
                    <li>
                        <a href="${qw.url}" class="ticket-link">#${qw.ticketId}</a> - 
                        ${qw.reason} (~${qw.estimatedMinutes || 20} min)
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${sections.closure_candidates && sections.closure_candidates.length > 0 ? `
            <div class="section" id="closure">
                <h2><span class="emoji">📋</span>Closure Candidates - Ready to Close</h2>
                <ul>
                ${sections.closure_candidates.map(candidate => `
                    <li>
                        <a href="${candidate.url}" class="ticket-link">#${candidate.ticketId}</a> - 
                        ${candidate.reason}
                        <br><small><strong>Last Activity:</strong> ${candidate.lastActivity}</small>
                        <br><small><strong>Assigned:</strong> <span class="tech-name">${candidate.assigned}</span></small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${sections.tech_performance && Object.keys(sections.tech_performance).length > 0 ? `
            <div class="section" id="tech-performance">
                <h2><span class="emoji">👥</span>Technician Performance Summary (All Active Techs)</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #000000; margin-top: 15px;">
                    <tr>
                        <th style="background-color: #1e3a5f; color: #ffffff; padding: 10px; text-align: left; border: 1px solid #000000; font-weight: bold;">Technician Email</th>
                        <th style="background-color: #1e3a5f; color: #ffffff; padding: 10px; text-align: center; border: 1px solid #000000; font-weight: bold;">Total</th>
                        <th style="background-color: #1e3a5f; color: #ffffff; padding: 10px; text-align: center; border: 1px solid #000000; font-weight: bold;">Avg Age</th>
                        <th style="background-color: #1e3a5f; color: #ffffff; padding: 10px; text-align: center; border: 1px solid #000000; font-weight: bold;">Old %</th>
                        <th style="background-color: #1e3a5f; color: #ffffff; padding: 10px; text-align: left; border: 1px solid #000000; font-weight: bold;">Status</th>
                    </tr>
                ${Object.entries(sections.tech_performance)
                    .sort((a, b) => b[1].oldTicketPercent - a[1].oldTicketPercent)
                    .map(([techEmail, stats], index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f0f0f0'};">
                        <td style="padding: 8px; border: 1px solid #666666; color: #0044cc; font-weight: bold;">${techEmail}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; color: #000000; font-weight: bold;">${stats.totalTickets}</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; color: #000000;">${stats.avgAge} days</td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; background-color: ${stats.oldTicketPercent > 30 ? '#ffcccc' : stats.oldTicketPercent > 15 ? '#ffe6cc' : '#ffffff'}; color: ${stats.oldTicketPercent > 30 ? '#cc0000' : stats.oldTicketPercent > 15 ? '#ff6600' : '#000000'}; font-weight: bold;">${stats.oldTicketPercent}%</td>
                        <td style="padding: 8px; border: 1px solid #666666; color: ${stats.oldTicketPercent > 30 ? '#cc0000' : '#000000'}; font-weight: ${stats.oldTicketPercent > 30 ? 'bold' : 'normal'};">${stats.oldTicketPercent > 30 ? '⚠️ Review workload' : stats.oldTicketPercent > 15 ? 'Monitor aging' : '✓ Good'}</td>
                    </tr>
                `).join('')}
                </table>
                <p style="margin-top: 10px; font-size: 12px; color: #333333;">Sorted by aging percentage (highest first) • Old = 14+ days</p>
            </div>
            ` : ''}
            
            <div class="footer">
                <p>Generated by Intelligent Supervisor System • Next update: ${new Date(Date.now() + 24*60*60*1000).toLocaleDateString('en-US', {timeZone: 'America/New_York'})} at 6:30 AM EST</p>
                <p>🎯 Focus: Actionable insights with direct ticket links for immediate supervisor action</p>
            </div>
        </div>
    </body>
    </html>`;
  }
}

module.exports = EmailDispatcher;