// Clean Supervisor Dashboard System - Azure Functions v4
const { app } = require('@azure/functions');
const AzureSharePointService = require('./services/azureSharePointService');
const SupervisorDashboardService = require('./services/supervisorDashboardService');
const EmailDispatcher = require('./modules/emailDispatcher');
const DataProcessor = require('./modules/dataProcessor');

// Azure Function - Daily Supervisor Dashboard (Timer Trigger)
app.timer('supervisorDashboard', {
    schedule: '0 30 12 * * *', // 7:30 AM Eastern (12:30 PM UTC)
    handler: async (myTimer, context) => {
        context.log('🎯 Supervisor Dashboard System Started');
        
        try {
            // Initialize modular services
            const sharePointService = new AzureSharePointService();
            const dataProcessor = new DataProcessor();
            const supervisorService = new SupervisorDashboardService();
            const emailDispatcher = new EmailDispatcher();

            // Step 1: Get latest CSV data from SharePoint
            context.log('📊 Fetching ticket data from SharePoint...');
            const csvData = await sharePointService.getLatestTicketCSV();
            
            // Step 2: Process CSV data with BOM fixes
            context.log('🔍 Processing ticket data...');
            const processedData = await dataProcessor.processCSVContent(csvData.content, csvData.filename);
            
            // Step 3: Generate supervisor dashboard (using cheap Claude model)
            context.log('🧠 Generating AI-powered supervisor dashboard...');
            const supervisorReport = await supervisorService.generateSupervisorDailyReport(processedData);
            
            // Step 4: Send supervisor dashboard email
            const subject = `📋 Daily Helpdesk Supervisor Dashboard - ${new Date().toLocaleDateString()}`;
            context.log('📧 Sending supervisor dashboard...');
            await emailDispatcher.sendSupervisorDashboard(supervisorReport, subject);
            
            // Step 5: Save results for audit trail
            const today = new Date().toISOString().split('T')[0];
            await sharePointService.uploadAnalysisResults(supervisorReport, `Supervisor_Dashboard_${today}.json`);
            
            context.log('✅ Supervisor Dashboard completed successfully');
            
            return {
                status: 200,
                body: {
                    message: 'Supervisor dashboard sent successfully',
                    timestamp: new Date().toISOString(),
                    summary: {
                        totalTickets: supervisorReport.summary.totalOpen,
                        criticalActions: supervisorReport.summary.criticalActions,
                        slaRisks: supervisorReport.summary.slaRisks,
                        teamIssues: supervisorReport.summary.teamIssues
                    }
                }
            };
            
        } catch (error) {
            context.log('❌ Supervisor Dashboard failed:', error);
            
            // Send error notification to supervisor
            try {
                const emailDispatcher = new EmailDispatcher();
                await emailDispatcher.sendErrorNotification(error, 'Daily Supervisor Dashboard');
            } catch (emailError) {
                context.log('Failed to send error notification:', emailError);
            }
            
            throw error;
        }
    }
});

// Azure Function - Manual Supervisor Dashboard Trigger (HTTP)
app.http('triggerSupervisorDashboard', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('🔧 Manual supervisor dashboard trigger received');
        
        try {
            // Same logic as timer function
            const sharePointService = new AzureSharePointService();
            const dataProcessor = new DataProcessor();
            const supervisorService = new SupervisorDashboardService();
            const emailDispatcher = new EmailDispatcher();

            context.log('📊 Fetching latest ticket data from SharePoint...');
            const csvData = await sharePointService.getLatestTicketCSV();
            
            context.log('🔍 Processing ticket data...');
            const processedData = await dataProcessor.processCSVContent(csvData.content, csvData.filename);
            
            context.log('🧠 Generating AI-powered supervisor dashboard...');
            const supervisorReport = await supervisorService.generateSupervisorDailyReport(processedData);
            
            const subject = `📋 Manual Helpdesk Supervisor Dashboard - ${new Date().toLocaleDateString()}`;
            
            context.log('📧 Sending supervisor dashboard...');
            await emailDispatcher.sendSupervisorDashboard(supervisorReport, subject);
            
            return {
                status: 200,
                jsonBody: {
                    message: 'Supervisor dashboard sent successfully',
                    timestamp: new Date().toISOString(),
                    summary: supervisorReport.summary,
                    debug: {
                        filename: csvData.filename,
                        ticketsProcessed: processedData.totalRecords,
                        openTickets: processedData.openTickets.length,
                        aiModelUsed: 'claude-3-5-haiku-20241022'
                    }
                }
            };
            
        } catch (error) {
            context.log('Manual supervisor dashboard failed:', error);
            
            return {
                status: 500,
                jsonBody: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});

// Ticket Grading System Classes and Functions
const GradingDocumentationService = require('./utils/gradingDocumentation');

class TicketGradingService {
  constructor() {
    this.dailyReviewCounts = new Map(); // Track reviews per tech per day
    this.lastRunDate = null;
    this.nextRunMinutes = this.generateRandomInterval(); // 20-60 minutes
    
    // Technician email mapping - convert bhopb\username to username@banyancenters.com
    this.techEmailMap = {
      'BHOPB\\rmoll': 'rmoll@banyancenters.com',
      'bhopb\\rmoll': 'rmoll@banyancenters.com',
      'BHOPB\\rvoyer': 'rvoyer@banyancenters.com', 
      'bhopb\\rvoyer': 'rvoyer@banyancenters.com',
      'BHOPB\\dmui': 'dmui@banyancenters.com',
      'bhopb\\dmui': 'dmui@banyancenters.com',
      'BHOPB\\cbowra': 'cbowra@banyancenters.com',
      'bhopb\\cbowra': 'cbowra@banyancenters.com',
      'BHOPB\\jhouchin': 'jhouchin@banyancenters.com',
      'bhopb\\jhouchin': 'jhouchin@banyancenters.com'
    };
  }

  generateRandomInterval() {
    // Generate random interval between 20-60 minutes
    return Math.floor(Math.random() * (60 - 20 + 1)) + 20;
  }

  resetDailyCountsIfNeeded() {
    const today = new Date().toDateString();
    if (this.lastRunDate !== today) {
      this.dailyReviewCounts.clear();
      this.lastRunDate = today;
    }
  }

  getTechEmail(techAssigned) {
    if (!techAssigned) return null;
    
    const cleanTech = techAssigned.trim();
    const email = this.techEmailMap[cleanTech] || this.techEmailMap[cleanTech.toLowerCase()];
    
    if (!email) {
      console.warn(`⚠️ No email mapping found for technician: ${cleanTech}`);
      // Fallback: try to extract username and add domain
      const match = cleanTech.match(/(?:BHOPB\\|bhopb\\)(.+)/i);
      if (match) {
        return `${match[1]}@banyancenters.com`;
      }
    }
    
    return email;
  }

  canReviewTech(techAssigned) {
    if (!techAssigned) return false;
    
    const currentCount = this.dailyReviewCounts.get(techAssigned) || 0;
    return currentCount < 2; // Max 2 reviews per tech per day
  }

  selectRandomTicketForReview(ticketData) {
    // Get all open tickets with assigned technicians
    const eligibleTickets = ticketData.openTickets.filter(ticket => {
      const techAssigned = ticket.Tech_Assigned_Clean;
      return techAssigned && 
             techAssigned !== 'UNASSIGNED' && 
             this.canReviewTech(techAssigned) &&
             this.getTechEmail(techAssigned); // Must have valid email
    });

    if (eligibleTickets.length === 0) {
      console.log('⚠️ No eligible tickets found for review (all techs at daily limit or no assigned techs)');
      return null;
    }

    // Select random ticket
    const randomIndex = Math.floor(Math.random() * eligibleTickets.length);
    const selectedTicket = eligibleTickets[randomIndex];
    
    // Increment review count for this tech
    const currentCount = this.dailyReviewCounts.get(selectedTicket.Tech_Assigned_Clean) || 0;
    this.dailyReviewCounts.set(selectedTicket.Tech_Assigned_Clean, currentCount + 1);
    
    console.log(`🎯 Selected ticket ${selectedTicket.IssueID} for tech ${selectedTicket.Tech_Assigned_Clean} (review ${currentCount + 1}/2)`);
    return selectedTicket;
  }

  async gradeTicket(ticket) {
    try {
      // For testing, return a sample grade
      const grade = {
        grade: "B+",
        score: 87,
        strengths: ["Timely initial response", "Professional communication"],
        improvements: ["Could improve documentation detail", "Follow-up timing"],
        recommendations: ["Add more specific technical details to work notes", "Set calendar reminder for 24-hour follow-up"],
        summary: "Good overall performance with room for improvement in documentation practices"
      };

      return grade;

    } catch (error) {
      console.error('❌ Failed to grade ticket:', error);
      throw error;
    }
  }

  async sendGradeEmail(ticket, grade, techEmail) {
    try {
      const emailDispatcher = new EmailDispatcher();
      
      // TESTING MODE: Send to supervisor instead of technician
      const testingMode = process.env.GRADING_TESTING_MODE !== 'false';
      const actualRecipient = testingMode ? 
        (process.env.SUPERVISOR_EMAIL ? process.env.SUPERVISOR_EMAIL.split(',')[0].trim() : 'jhouchin@banyancenters.com') : 
        techEmail;
      
      const subject = testingMode ? 
        `🧪 [TESTING] Ticket Performance Review - Ticket #${ticket.IssueID} (for ${ticket.Tech_Assigned_Clean})` :
        `📊 Ticket Performance Review - Ticket #${ticket.IssueID}`;
      
      const testingNotice = testingMode ? `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin-bottom: 20px; border-radius: 4px; border-left: 4px solid #f39c12;">
          <h3 style="color: #856404; margin: 0 0 10px 0;">🧪 TESTING MODE</h3>
          <p style="margin: 0; color: #856404;">
            This grade would normally be sent to: <strong>${techEmail}</strong><br>
            Technician: <strong>${ticket.Tech_Assigned_Clean}</strong><br>
            Set GRADING_TESTING_MODE=false to send to actual technicians.
          </p>
        </div>
      ` : '';
      
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            
            ${testingNotice}
            
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin: 0; font-size: 24px;">📊 Ticket Performance Review</h1>
              <p style="color: #7f8c8d; margin: 10px 0 0 0;">Professional Development Feedback</p>
            </div>
            
            <div style="background-color: #e8f5e8; border-left: 4px solid #27ae60; padding: 15px; margin-bottom: 25px; border-radius: 0 4px 4px 0;">
              <h2 style="color: #27ae60; margin: 0 0 10px 0; font-size: 20px;">Grade: ${grade.grade} (${grade.score}%)</h2>
              <p style="margin: 0; color: #2c3e50;">${grade.summary}</p>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #2c3e50; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px;">📋 Ticket Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1; font-weight: bold;">Ticket ID:</td><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1;">${ticket.IssueID}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1; font-weight: bold;">Subject:</td><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1;">${ticket.Subject}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1; font-weight: bold;">Customer:</td><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1;">${ticket.Customer_Name}</td></tr>
                <tr><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1; font-weight: bold;">Priority:</td><td style="padding: 8px 0; border-bottom: 1px solid #ecf0f1;">${ticket.Priority}</td></tr>
              </table>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #27ae60; margin: 0 0 15px 0; font-size: 16px;">✅ Identified Strengths</h3>
              <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                ${grade.strengths.map(strength => `<li style="margin-bottom: 8px;">${strength}</li>`).join('')}
              </ul>
            </div>
            
            <div style="margin-bottom: 25px;">
              <h3 style="color: #f39c12; margin: 0 0 15px 0; font-size: 16px;">⚠️ Areas for Improvement</h3>
              <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                ${grade.improvements.map(improvement => `<li style="margin-bottom: 8px;">${improvement}</li>`).join('')}
              </ul>
            </div>
            
            <div style="margin-bottom: 30px;">
              <h3 style="color: #3498db; margin: 0 0 15px 0; font-size: 16px;">💡 Specific Recommendations</h3>
              <ul style="margin: 0; padding-left: 20px; color: #2c3e50;">
                ${grade.recommendations.map(recommendation => `<li style="margin-bottom: 8px;">${recommendation}</li>`).join('')}
              </ul>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; text-align: center;">
              <p style="margin: 0; color: #7f8c8d; font-size: 14px;">
                This review is part of our continuous improvement process.<br>
                Questions about this feedback? Contact your supervisor.
              </p>
            </div>
          </div>
        </div>`;
      
      await emailDispatcher.sendEmail(actualRecipient, subject, emailContent);
      console.log(`📧 Grade email sent to ${actualRecipient} for ticket ${ticket.IssueID} ${testingMode ? '(TESTING MODE)' : ''}`);
      
    } catch (error) {
      console.error('❌ Failed to send grade email:', error);
      throw error;
    }
  }
}

// Azure Function - Manual Ticket Grading Trigger (HTTP)
app.http('triggerTicketGrading', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log('🔧 Manual ticket grading trigger received');
    
    try {
      const gradingService = new TicketGradingService();
      gradingService.resetDailyCountsIfNeeded();
      
      const sharePointService = new AzureSharePointService();
      const dataProcessor = new DataProcessor();
      
      context.log('📊 Fetching latest ticket data...');
      const csvData = await sharePointService.getLatestTicketCSV();
      
      context.log('🔍 Processing ticket data...');
      const processedData = await dataProcessor.processCSVContent(csvData.content, csvData.filename);
      
      context.log('🎲 Selecting random ticket for manual review...');
      const selectedTicket = gradingService.selectRandomTicketForReview(processedData);
      
      if (!selectedTicket) {
        return {
          status: 200,
          jsonBody: { 
            message: 'No eligible tickets for review',
            reason: 'All technicians at daily review limit or no assigned tickets'
          }
        };
      }
      
      const techEmail = gradingService.getTechEmail(selectedTicket.Tech_Assigned_Clean);
      if (!techEmail) {
        return {
          status: 400,
          jsonBody: { 
            error: 'No email mapping found',
            technician: selectedTicket.Tech_Assigned_Clean 
          }
        };
      }
      
      context.log(`🧠 Grading ticket ${selectedTicket.IssueID}...`);
      const grade = await gradingService.gradeTicket(selectedTicket);
      
      context.log('📧 Sending performance review email...');
      await gradingService.sendGradeEmail(selectedTicket, grade, techEmail);
      
      // Record grade for documentation and tracking
      context.log('📝 Recording grade for monthly tracking...');
      const documentationService = new GradingDocumentationService();
      await documentationService.recordTicketGrade(selectedTicket, grade, techEmail);
      
      return {
        status: 200,
        jsonBody: {
          message: 'Manual ticket grading completed',
          ticketId: selectedTicket.IssueID,
          technician: selectedTicket.Tech_Assigned_Clean,
          techEmail: techEmail,
          grade: grade.grade,
          score: grade.score,
          timestamp: new Date().toISOString(),
          testingMode: process.env.GRADING_TESTING_MODE !== 'false',
          emailSentTo: process.env.GRADING_TESTING_MODE !== 'false' ? 
            (process.env.SUPERVISOR_EMAIL ? process.env.SUPERVISOR_EMAIL.split(',')[0].trim() : 'jhouchin@banyancenters.com') : 
            techEmail
        }
      };
      
    } catch (error) {
      context.log('Manual ticket grading failed:', error);
      
      return {
        status: 500,
        jsonBody: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
});

