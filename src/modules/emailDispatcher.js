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
    console.log('📧 Sending AI-powered supervisor dashboard email...');
    
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
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 300; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0; }
            .summary-card { padding: 25px; text-align: center; border-bottom: 1px solid #e1e5e9; }
            .summary-card:nth-child(even) { background: #f8f9fa; }
            .summary-value { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
            .summary-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
            .section { padding: 30px; border-bottom: 1px solid #e1e5e9; }
            .section h2 { color: #dc3545; margin-top: 0; font-size: 18px; }
            .priority-high { color: #dc3545; font-weight: bold; }
            .priority-medium { color: #ffc107; font-weight: bold; }
            .priority-critical { color: #dc3545; background: #fff5f5; padding: 2px 6px; border-radius: 4px; }
            .tech-name { font-weight: bold; color: #0066cc; }
            .ticket-id { font-family: monospace; background: #f8f9fa; padding: 2px 6px; border-radius: 4px; }
            .footer { padding: 20px; text-align: center; background: #f8f9fa; color: #666; font-size: 12px; }
            ul { margin: 10px 0; padding-left: 20px; }
            li { margin: 5px 0; line-height: 1.4; }
            .ai-tag { background: #0066cc; color: white; padding: 2px 6px; border-radius: 12px; font-size: 11px; margin-left: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📋 Daily Helpdesk Supervisor Dashboard</h1>
                <p>${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString()} • AI-Powered Insights <span class="ai-tag">Claude 3.5</span></p>
            </div>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-value">${summary.totalOpen}</div>
                    <div class="summary-label">Total Open Tickets</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value priority-critical">${summary.criticalActions}</div>
                    <div class="summary-label">Critical Actions Needed</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value priority-high">${summary.slaRisks}</div>
                    <div class="summary-label">SLA Risk Tickets</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value ${summary.teamIssues > 0 ? 'priority-medium' : ''}">${summary.teamIssues}</div>
                    <div class="summary-label">Team Coaching Needed</div>
                </div>
            </div>
            
            ${analysis.daily_priorities && analysis.daily_priorities.length > 0 ? `
            <div class="section">
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
            <div class="section">
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
            <div class="section">
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
                <p>🤖 Generated by AI Supervisor Assistant using Claude 3.5 Haiku • Next update: ${new Date(Date.now() + 24*60*60*1000).toLocaleDateString()} at 6:30 AM</p>
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
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0; }
            .summary-card { padding: 20px; text-align: center; border-bottom: 1px solid #e1e5e9; }
            .summary-card:nth-child(even) { background: #f8f9fa; }
            .summary-value { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .summary-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
            .section { padding: 25px; border-bottom: 1px solid #e1e5e9; }
            .section h2 { color: #dc3545; margin-top: 0; font-size: 18px; display: flex; align-items: center; }
            .section h2 .emoji { margin-right: 8px; }
            .critical { color: #dc3545; font-weight: bold; background: #fff5f5; padding: 2px 8px; border-radius: 4px; }
            .high { color: #fd7e14; font-weight: bold; }
            .medium { color: #ffc107; font-weight: bold; }
            .ticket-link { font-family: monospace; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; text-decoration: none; color: #0066cc; border: 1px solid #dee2e6; }
            .ticket-link:hover { background: #e9ecef; }
            .tech-name { font-weight: bold; color: #0066cc; }
            .aging-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin: 15px 0; }
            .aging-bucket { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #dee2e6; }
            .aging-bucket.critical { border-color: #dc3545; background: #fff5f5; }
            .aging-bucket.concern { border-color: #ffc107; background: #fffbf0; }
            .bucket-count { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .bucket-label { font-size: 12px; color: #666; }
            ul { margin: 10px 0; padding-left: 20px; }
            li { margin: 8px 0; line-height: 1.5; }
            .perf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
            .perf-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
            .footer { padding: 20px; text-align: center; background: #f8f9fa; color: #666; font-size: 12px; }
            .ai-badge { background: #28a745; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚡ Actionable Supervisor Dashboard</h1>
                <p>${new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'})} • ${new Date().toLocaleTimeString('en-US', {timeZone: 'America/New_York'})} EST • AI-Enhanced Insights <span class="ai-badge">Claude 3.5</span></p>
            </div>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-value">${summary.totalOpen}</div>
                    <div class="summary-label">Total Open Tickets</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value critical">${summary.slaViolations}</div>
                    <div class="summary-label">SLA Violations</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value ${summary.noTechResponse3Days > 50 ? 'critical' : summary.noTechResponse3Days > 20 ? 'high' : 'medium'}">${summary.noTechResponse3Days}</div>
                    <div class="summary-label">3+ Days No Tech Response</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value ${summary.criticalAging > 20 ? 'critical' : summary.criticalAging > 10 ? 'high' : ''}">${summary.criticalAging}</div>
                    <div class="summary-label">Critical Aging (22+ Days)</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value ${summary.immediateTriage > 0 ? 'high' : ''}">${summary.immediateTriage}</div>
                    <div class="summary-label">Immediate Triage</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value ${summary.vipAlerts > 0 ? 'critical' : ''}">${summary.vipAlerts}</div>
                    <div class="summary-label">VIP Alerts</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value ${summary.quickWins > 0 ? 'high' : ''}">${summary.quickWins}</div>
                    <div class="summary-label">Quick Wins</div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-value">${summary.closureCandidates}</div>
                    <div class="summary-label">Ready to Close</div>
                </div>
            </div>
            
            ${sections.sla_violations && sections.sla_violations.length > 0 ? `
            <div class="section">
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
            <div class="section">
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
            <div class="section">
                <h2><span class="emoji">📊</span>Ticket Aging Analysis</h2>
                <div class="aging-grid">
                    <div class="aging-bucket">
                        <div class="bucket-count">${sections.aging_analysis.buckets['0-3_days'].length}</div>
                        <div class="bucket-label">0-3 Days<br>Fresh</div>
                    </div>
                    <div class="aging-bucket">
                        <div class="bucket-count">${sections.aging_analysis.buckets['4-7_days'].length}</div>
                        <div class="bucket-label">4-7 Days<br>Normal</div>
                    </div>
                    <div class="aging-bucket">
                        <div class="bucket-count">${sections.aging_analysis.buckets['8-14_days'].length}</div>
                        <div class="bucket-label">8-14 Days<br>Watch</div>
                    </div>
                    <div class="aging-bucket concern">
                        <div class="bucket-count">${sections.aging_analysis.buckets['15-21_days'].length}</div>
                        <div class="bucket-label">15-21 Days<br>Manager Review</div>
                    </div>
                    <div class="aging-bucket critical">
                        <div class="bucket-count">${sections.aging_analysis.buckets['22+_days'].length}</div>
                        <div class="bucket-label">22+ Days<br>Escalate</div>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${sections.immediate_triage && sections.immediate_triage.length > 0 ? `
            <div class="section">
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
            <div class="section">
                <h2><span class="emoji">👑</span>VIP Alerts - Executive/Director Tickets</h2>
                <ul>
                ${sections.vip_alerts.map(vip => `
                    <li>
                        <a href="${vip.url}" class="ticket-link">#${vip.ticketId}</a> - 
                        <strong>${vip.submitter}</strong> (${vip.age} days)
                        <br><small><strong>Subject:</strong> ${vip.subject}</small>
                        <br><small><strong>Assigned:</strong> <span class="tech-name">${vip.assigned}</span></small>
                    </li>
                `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${sections.quick_wins && sections.quick_wins.length > 0 ? `
            <div class="section">
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
            <div class="section">
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
            <div class="section">
                <h2><span class="emoji">👥</span>Technician Performance Summary</h2>
                <div class="perf-grid">
                ${Object.entries(sections.tech_performance).slice(0, 8).map(([tech, stats]) => `
                    <div class="perf-card">
                        <div class="tech-name">${tech.replace('bhopb', '')}</div>
                        <div style="margin: 8px 0; font-size: 14px;">
                            <strong>${stats.totalTickets}</strong> tickets • 
                            <strong>${stats.avgAge}</strong> days avg • 
                            <span class="${stats.oldTicketPercent > 30 ? 'critical' : stats.oldTicketPercent > 15 ? 'high' : ''}">${stats.oldTicketPercent}%</span> aging
                        </div>
                    </div>
                `).join('')}
                </div>
            </div>
            ` : ''}
            
            <div class="footer">
                <p>🤖 Generated by AI Supervisor Assistant using Claude 3.5 Haiku • Next update: ${new Date(Date.now() + 24*60*60*1000).toLocaleDateString('en-US', {timeZone: 'America/New_York'})} at 6:30 AM EST</p>
                <p>🎯 Focus: Actionable insights with direct ticket links for immediate supervisor action</p>
            </div>
        </div>
    </body>
    </html>`;
  }
}

module.exports = EmailDispatcher;