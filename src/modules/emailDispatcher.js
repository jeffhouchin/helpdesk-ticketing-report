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
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #cc0000; margin-top: 15px;">
                    <tr>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Ticket</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Type</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Subject</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Tech</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">SLA Status</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 8px; text-align: center; border: 1px solid #000000; font-weight: bold;">Action Required</th>
                    </tr>
                ${sections.sla_violations.slice(0, 15).map((violation, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f0f0f0'};">
                        <td style="padding: 10px; border: 1px solid #666666; border-bottom: 2px solid #cccccc;">
                            <a href="${violation.url}" style="color: #cc0000; font-weight: bold; text-decoration: underline;">#${violation.ticketId}</a>
                        </td>
                        <td style="padding: 10px; border: 1px solid #666666; border-bottom: 2px solid #cccccc; font-weight: bold; color: ${violation.severity === 'CRITICAL' ? '#cc0000' : '#ff6600'};">
                            ${violation.type.replace(/_/g, ' ')}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 2px solid #cccccc; font-size: 11px;">
                            ${(violation.subject || 'N/A').substring(0, 40)}${violation.subject && violation.subject.length > 40 ? '...' : ''}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 2px solid #cccccc; color: ${violation.assigned === 'UNASSIGNED' ? '#cc0000' : '#0044cc'}; font-weight: bold;">
                            ${violation.assigned === 'UNASSIGNED' ? 'UNASSIGNED' : (violation.assignedUsername || violation.assigned.split('@')[0] || violation.assigned)}
                        </td>
                        <td style="padding: 10px; border: 1px solid #666666; border-bottom: 2px solid #cccccc; font-size: 11px;">
                            ${violation.message}
                        </td>
                        <td style="padding: 10px; border: 1px solid #666666; border-bottom: 2px solid #cccccc; background-color: #ffcccc; text-align: center; font-weight: bold; color: #cc0000;">
                            ${violation.action.replace(/_/g, ' ')}
                        </td>
                    </tr>
                `).join('')}
                </table>
                <p style="margin: 10px 0 0 0; text-align: right;"><a href="#top" style="color: #0044cc; font-size: 12px;">↑ Back to Top</a></p>
            </div>
            ` : ''}
            
            ${sections.no_tech_response_3days && sections.no_tech_response_3days.length > 0 ? `
            <div class="section" id="no-response">
                <h2><span class="emoji">⏰</span>3+ Days No Tech Response - Priority Follow-Up Required</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #ff6600; margin-top: 15px;">
                    <tr>
                        <th style="background-color: #ff6600; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Ticket</th>
                        <th style="background-color: #ff6600; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Status</th>
                        <th style="background-color: #ff6600; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Subject</th>
                        <th style="background-color: #ff6600; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Tech</th>
                        <th style="background-color: #ff6600; color: #ffffff; padding: 8px; text-align: center; border: 1px solid #000000; font-weight: bold;">Days Old</th>
                        <th style="background-color: #ff6600; color: #ffffff; padding: 8px; text-align: center; border: 1px solid #000000; font-weight: bold;">Last Tech Response</th>
                    </tr>
                ${sections.no_tech_response_3days.slice(0, 20).map((ticket, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#fff0e6'};">
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc;">
                            <a href="${ticket.url}" style="color: #ff6600; font-weight: bold; text-decoration: underline;">#${ticket.ticketId}</a>
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-weight: bold; color: #000000;">
                            ${ticket.status || 'New'}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-size: 12px;">
                            ${ticket.subject}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; color: ${ticket.assigned === 'UNASSIGNED' ? '#cc0000' : '#0044cc'}; font-weight: bold;">
                            ${ticket.assigned === 'UNASSIGNED' ? 'NONE' : (ticket.assignedUsername || ticket.assigned.split('@')[0] || ticket.assigned)}
                        </td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; border-bottom: 1px solid #cccccc; color: ${ticket.daysSinceCreated > 7 ? '#cc0000' : '#000000'}; font-weight: bold;">
                            ${ticket.daysSinceCreated}
                        </td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; border-bottom: 1px solid #cccccc; color: #cc0000; font-weight: bold;">
                            ${ticket.daysSinceLastTechResponse === ticket.daysSinceCreated ? 'NEVER' : `${ticket.daysSinceLastTechResponse} days ago`}
                        </td>
                    </tr>
                `).join('')}
                </table>
                ${sections.no_tech_response_3days.length > 20 ? `<p style="margin-top: 10px; font-style: italic;">+ ${sections.no_tech_response_3days.length - 20} more tickets requiring tech response...</p>` : ''}
                <p style="margin: 10px 0 0 0; text-align: right;"><a href="#top" style="color: #0044cc; font-size: 12px;">↑ Back to Top</a></p>
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
                        <th style="background-color: #cc0000; color: #ffffff; padding: 6px; text-align: left; border: 1px solid #000000;">VIP</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 6px; text-align: left; border: 1px solid #000000;">From</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 6px; text-align: left; border: 1px solid #000000;">Subject</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 6px; text-align: center; border: 1px solid #000000;">Days</th>
                        <th style="background-color: #cc0000; color: #ffffff; padding: 6px; text-align: left; border: 1px solid #000000;">Tech</th>
                    </tr>
                ${sections.vip_alerts.map((vip, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffcccc' : '#ffe6e6'};">
                        <td style="padding: 8px; border: 1px solid #666666;">
                            <a href="${vip.url}" style="color: #cc0000; font-weight: bold; text-decoration: underline;">#${vip.ticketId}</a>
                        </td>
                        <td style="padding: 6px; border: 1px solid #666666; font-weight: bold; color: #cc0000; font-size: 11px;">
                            ${vip.vipTerm ? vip.vipTerm.toUpperCase() : 'VIP'}
                        </td>
                        <td style="padding: 6px; border: 1px solid #666666; color: #000000; font-size: 11px;">
                            <strong>${vip.submitterUsername || vip.submitter.split('@')[0] || vip.submitter}</strong>
                        </td>
                        <td style="padding: 6px; border: 1px solid #666666; color: #000000; font-size: 11px;">
                            ${(vip.subject || '').substring(0, 35)}${vip.subject && vip.subject.length > 35 ? '...' : ''}
                        </td>
                        <td style="padding: 6px; text-align: center; border: 1px solid #666666; color: ${vip.age > 3 ? '#cc0000' : '#000000'}; font-weight: bold;">
                            ${vip.age}
                        </td>
                        <td style="padding: 6px; border: 1px solid #666666; color: ${vip.assigned === 'UNASSIGNED' ? '#cc0000' : '#0044cc'}; font-weight: bold; font-size: 11px;">
                            ${vip.assigned === 'UNASSIGNED' ? 'NONE' : (vip.assignedUsername || vip.assigned.split('@')[0] || vip.assigned)}
                        </td>
                    </tr>
                `).join('')}
                </table>
                <p style="margin-top: 10px; font-size: 12px; color: #cc0000; font-weight: bold;">⚠️ VIP Detection: Matches keywords (director, vp, president, ceo, cfo, cto, executive) in submitter name, subject, or ticket body</p>
            </div>
            ` : ''}
            
            ${sections.quick_wins ? (sections.quick_wins.length > 0 ? `
            <div class="section" id="quickwins">
                <h2><span class="emoji">🎯</span>Quick Wins - Easy Resolutions</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #008800; margin-top: 15px;">
                    <tr>
                        <th style="background-color: #008800; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Ticket</th>
                        <th style="background-color: #008800; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Category</th>
                        <th style="background-color: #008800; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Issue Analysis</th>
                        <th style="background-color: #008800; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Quick Action</th>
                    </tr>
                ${sections.quick_wins.map((qw, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f0fff0'};">
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc;">
                            <a href="${qw.url}" style="color: #008800; font-weight: bold; text-decoration: underline;">#${qw.ticketId}</a>
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-weight: bold; color: #008800;">
                            ${qw.category || 'Quick Win'}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-size: 12px;">
                            ${qw.aiAnalysis || qw.issue || 'Quick resolution needed'}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-size: 12px;">
                            ${qw.quickAction || qw.solution || 'Standard resolution'}
                        </td>
                    </tr>
                `).join('')}
                </table>
                <p style="margin: 10px 0 0 0; text-align: right;"><a href="#top" style="color: #0044cc; font-size: 12px;">↑ Back to Top</a></p>
            </div>
            ` : `
            <div class="section" id="quickwins">
                <h2><span class="emoji">🎯</span>Quick Wins - AI Analysis Required</h2>
                <p style="padding: 20px; background-color: #fffbf0; border: 1px solid #ff9900; color: #333333;">
                    ⚠️ <strong>AI-powered ticket analysis is not configured.</strong><br><br>
                    To enable intelligent Quick Wins analysis that provides specific issue descriptions and resolution steps:<br><br>
                    1. Set <code>CLAUDE_API_KEY</code> in Azure Function app settings<br>
                    2. AI will then analyze ticket content and provide specific recommendations<br>
                    3. Without AI, this section cannot generate meaningful insights
                </p>
            </div>
            `) : ''}
            
            ${sections.closure_candidates && sections.closure_candidates.length > 0 ? `
            <div class="section" id="closure">
                <h2><span class="emoji">📋</span>Closure Candidates - Ready to Close</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #0044cc; margin-top: 15px;">
                    <tr>
                        <th style="background-color: #0044cc; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Ticket</th>
                        <th style="background-color: #0044cc; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Subject</th>
                        <th style="background-color: #0044cc; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Reason for Closure</th>
                        <th style="background-color: #0044cc; color: #ffffff; padding: 8px; text-align: left; border: 1px solid #000000; font-weight: bold;">Assigned Tech</th>
                        <th style="background-color: #0044cc; color: #ffffff; padding: 8px; text-align: center; border: 1px solid #000000; font-weight: bold;">Last Activity</th>
                    </tr>
                ${sections.closure_candidates.map((candidate, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f0f0ff'};">
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc;">
                            <a href="${candidate.url}" style="color: #0044cc; font-weight: bold; text-decoration: underline;">#${candidate.ticketId}</a>
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-size: 12px;">
                            ${candidate.subject || 'N/A'}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; font-size: 12px;">
                            ${candidate.reason}
                        </td>
                        <td style="padding: 8px; border: 1px solid #666666; border-bottom: 1px solid #cccccc; color: #0044cc; font-weight: bold;">
                            ${candidate.assigned}
                        </td>
                        <td style="padding: 8px; text-align: center; border: 1px solid #666666; border-bottom: 1px solid #cccccc;">
                            ${candidate.lastActivity}
                        </td>
                    </tr>
                `).join('')}
                </table>
                <p style="margin: 10px 0 0 0; text-align: right;"><a href="#top" style="color: #0044cc; font-size: 12px;">↑ Back to Top</a></p>
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