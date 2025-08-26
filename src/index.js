#!/usr/bin/env node

const SharePointService = require('./services/sharepointService');
const TicketAnalyzer = require('./services/ticketAnalyzer');
const EmailService = require('./services/emailService');
const config = require('./config');

class HelpdeskReportBot {
  constructor() {
    this.sharepointService = new SharePointService();
    this.ticketAnalyzer = new TicketAnalyzer();
    this.emailService = new EmailService();
  }

  async run() {
    try {
      console.log('🚀 Starting Helpdesk Report Bot...');
      console.log(`📅 ${new Date().toLocaleString()}`);

      // Download and parse the latest spreadsheet
      console.log('📥 Downloading spreadsheet from SharePoint/OneDrive...');
      const tickets = await this.sharepointService.parseSpreadsheet();
      console.log(`✅ Found ${tickets.length} tickets`);

      // Analyze tickets
      console.log('🔍 Analyzing tickets...');
      const analysis = this.ticketAnalyzer.analyzeTickets(tickets);
      
      // Log summary
      this.logSummary(analysis.summary);

      // Send notifications if enabled
      if (config.notifications.sendDailySummary) {
        console.log('📧 Sending daily summary...');
        await this.emailService.sendDailySummary(analysis);
        console.log('✅ Daily summary sent');
      }

      // Send individual reminders if enabled
      if (config.notifications.sendIndividualReminders) {
        await this.sendIndividualReminders(analysis);
      }

      console.log('🎉 Helpdesk Report Bot completed successfully!');
      return analysis;

    } catch (error) {
      console.error('❌ Error running Helpdesk Report Bot:', error);
      
      // Send error notification to manager
      if (config.analysis.managerEmail) {
        try {
          await this.emailService.sendEmail({
            to: config.analysis.managerEmail,
            subject: 'Helpdesk Report Bot Error',
            html: `
              <h2>🚨 Helpdesk Report Bot Error</h2>
              <p>An error occurred while generating the daily report:</p>
              <pre>${error.message}</pre>
              <p>Please check the system and logs.</p>
              <p>Time: ${new Date().toLocaleString()}</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send error notification:', emailError);
        }
      }
      
      throw error;
    }
  }

  async sendIndividualReminders(analysis) {
    console.log('📬 Sending individual reminders...');
    
    let remindersSent = 0;
    
    // Send reminders for tickets needing technician response
    for (const ticket of analysis.noTechnicianResponse) {
      if (ticket.assignee && this.isValidEmail(ticket.assignee)) {
        try {
          await this.emailService.sendTechnicianReminder(ticket, ticket.assignee);
          remindersSent++;
        } catch (error) {
          console.error(`Failed to send reminder for ticket ${ticket.id}:`, error);
        }
      }
    }

    // Send reminders for overdue tickets
    for (const ticket of analysis.overdueTickets) {
      if (ticket.assignee && this.isValidEmail(ticket.assignee)) {
        try {
          await this.emailService.sendTechnicianReminder(ticket, ticket.assignee);
          remindersSent++;
        } catch (error) {
          console.error(`Failed to send overdue reminder for ticket ${ticket.id}:`, error);
        }
      }
    }

    console.log(`✅ Sent ${remindersSent} individual reminders`);
  }

  logSummary(summary) {
    console.log('\n📊 TICKET SUMMARY:');
    console.log(`   📋 Total Open: ${summary.totalOpen}`);
    console.log(`   ⏰ Overdue: ${summary.overdue}`);
    console.log(`   😴 Stale: ${summary.stale} (${summary.stalePercentage}%)`);
    console.log(`   🚨 No Response: ${summary.noResponse}`);
    console.log(`   ⚡ Quick Wins: ${summary.quickWins}`);
    console.log(`   🔥 High Priority: ${summary.highPriority}`);
    console.log('');
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Helpdesk Report Bot - AI-powered ticket analysis and notifications

Usage:
  npm start                 Run full analysis and send notifications
  npm run analyze          Run analysis only (no emails)
  node src/index.js --dry-run    Analyze without sending emails
  
Environment:
  Copy .env.example to .env and configure your settings
  
Options:
  --help, -h               Show this help
  --dry-run               Run analysis without sending emails
  --config <file>         Use custom config file
    `);
    process.exit(0);
  }

  // Override config for dry run
  if (args.includes('--dry-run')) {
    config.notifications.sendDailySummary = false;
    config.notifications.sendIndividualReminders = false;
    console.log('🔄 Running in DRY RUN mode - no emails will be sent');
  }

  const bot = new HelpdeskReportBot();
  
  try {
    const analysis = await bot.run();
    process.exit(0);
  } catch (error) {
    console.error('Bot failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = HelpdeskReportBot;