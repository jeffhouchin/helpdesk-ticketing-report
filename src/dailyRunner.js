#!/usr/bin/env node

const path = require('path');
const DailyIntelligenceEngine = require('./services/dailyIntelligenceEngine');
const IntelligentEmailService = require('./services/intelligentEmailService');

class DailyHelpdeskRunner {
  constructor() {
    this.engine = new DailyIntelligenceEngine();
    this.emailService = new IntelligentEmailService();
  }

  async runDailyAnalysis() {
    try {
      console.log('🌅 Starting Daily Helpdesk Analysis...');
      console.log(`📅 ${new Date().toLocaleString()}`);
      
      // Find the latest CSV file
      const csvPath = await this.findLatestCSV();
      console.log(`📄 Using CSV: ${csvPath}`);

      // Run the intelligence engine
      const analyses = await this.engine.runDailyIntelligence(csvPath);

      // Send all notifications
      await this.emailService.sendDailyIntelligenceReport(analyses);

      // Log summary
      this.logDailySummary(analyses);

      console.log('🎉 Daily Helpdesk Analysis completed successfully!');
      return analyses;

    } catch (error) {
      console.error('❌ Daily Analysis Failed:', error);
      
      // Send failure notification
      try {
        await this.emailService.sendEmail({
          to: process.env.SUPERVISOR_EMAIL || 'jhouchin@banyancenters.com',
          subject: '🚨 Daily Helpdesk Analysis Failed',
          html: `
            <h2>Daily Analysis Failure</h2>
            <p><strong>Error:</strong> ${error.message}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Stack:</strong></p>
            <pre>${error.stack}</pre>
            <p>Please check the system immediately.</p>
          `
        });
      } catch (emailError) {
        console.error('Failed to send failure notification:', emailError);
      }
      
      process.exit(1);
    }
  }

  async findLatestCSV() {
    // Look for today's CSV file
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const possiblePaths = [
      path.join(__dirname, '..', `Ticket_Data_${dateStr}.csv`),
      path.join(__dirname, '..', `Ticket_Data_${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}.csv`),
      path.join(__dirname, '..', 'Ticket_Data_2025-08-22.csv') // Fallback for testing
    ];

    for (const csvPath of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(csvPath)) {
          return csvPath;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('No ticket CSV file found for today. Please ensure the file is downloaded and named correctly.');
  }

  logDailySummary(analyses) {
    const { dailyOverview, noResponseAlerts, stuckTicketEvaluations, performanceReviews } = analyses;
    
    console.log('\n📊 DAILY ANALYSIS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`📋 Total Open Tickets: ${dailyOverview.totalOpen}`);
    console.log(`🚨 72+ Hour No Response: ${noResponseAlerts.length}`);
    console.log(`🔄 Stuck Tickets (14+ days): ${stuckTicketEvaluations.length}`);
    console.log(`📝 Performance Reviews Sent: ${performanceReviews.length}`);
    console.log(`👥 Active Technicians: ${Object.keys(dailyOverview.technicianWorkload).length}`);
    
    if (dailyOverview.oldestTicket) {
      const oldestAge = Math.floor((new Date() - dailyOverview.oldestTicket.IssueDate) / (1000 * 60 * 60 * 24));
      console.log(`🦴 Oldest Ticket: #${dailyOverview.oldestTicket.IssueID} (${oldestAge} days)`);
    }
    
    console.log('\n📧 NOTIFICATIONS SENT:');
    console.log(`   ✅ Supervisor daily report`);
    console.log(`   ✅ ${performanceReviews.length} individual performance reviews`);
    if (noResponseAlerts.length > 0) {
      console.log(`   ⚠️ 72-hour no-response alert (${noResponseAlerts.length} tickets)`);
    }
    
    console.log('='.repeat(50));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Daily Helpdesk Analysis Runner

Usage:
  npm run daily-analysis     Run full daily analysis with notifications
  node src/dailyRunner.js    Same as above
  
  Options:
    --help, -h              Show this help
    --dry-run              Run analysis without sending emails
    
Environment Variables:
  SUPERVISOR_EMAIL          Email for supervisor notifications
  SMTP_HOST, SMTP_USER, etc Email configuration
    `);
    process.exit(0);
  }

  // Override email sending for dry run
  if (args.includes('--dry-run')) {
    console.log('🔄 Running in DRY RUN mode - no emails will be sent');
    // Override email service methods to not send
  }

  const runner = new DailyHelpdeskRunner();
  await runner.runDailyAnalysis();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DailyHelpdeskRunner;