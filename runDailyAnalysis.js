// Daily Helpdesk Intelligence Analysis Runner
// This runs locally on your machine at 6:30 AM daily via Task Scheduler

require('dotenv').config();
const DailyIntelligenceEngine = require('./src/services/dailyIntelligenceEngine');
const Claude4Service = require('./src/services/claude4Service');
const fs = require('fs');
const path = require('path');

// Simple email service for local execution
class LocalEmailService {
    constructor() {
        this.supervisorEmails = ['jhouchin@banyancenters.com', 'rmoll@banyancenters.com', 'cbowra@banyancenters.com'];
    }

    async sendDailySupervisorReport(results) {
        console.log('📧 Email report would be sent to:', this.supervisorEmails.join(', '));
        console.log('📊 Results Summary:', {
            totalTickets: results.summary?.totalTickets || 0,
            noResponseAlerts: results.noResponseAlerts?.length || 0,
            stuckTickets: results.stuckTickets?.length || 0
        });
        
        // For now, save results to a file you can email manually
        const reportPath = path.join(__dirname, `daily-report-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`📁 Report saved to: ${reportPath}`);
        
        return { success: true, message: 'Report generated successfully' };
    }

    async sendErrorNotification(error, context) {
        console.error(`❌ Error in ${context}:`, error.message);
    }
}

async function runDailyAnalysis() {
    console.log(`🚀 Daily Helpdesk Intelligence Analysis Started - ${new Date().toLocaleString()}`);
    
    try {
        // Initialize services
        const claudeService = new Claude4Service();
        const emailService = new LocalEmailService();
        const analysisEngine = new DailyIntelligenceEngine(claudeService, emailService);

        // Use the existing CSV file (you'll need to update this path daily or automate CSV download)
        const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-22.csv');
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        const csvContent = fs.readFileSync(csvPath, 'utf8');
        console.log('📊 Loaded ticket data from CSV');

        // Run full analysis with Claude 4 Sonnet
        console.log('🧠 Running AI analysis with Claude 4 Sonnet...');
        const results = await analysisEngine.runDailyAnalysis(csvContent);
        
        console.log('📧 Preparing supervisor reports...');
        await emailService.sendDailySupervisorReport(results);
        
        console.log('✅ Daily analysis completed successfully!');
        console.log(`📈 Analyzed ${results.summary?.totalTickets || 0} tickets`);
        console.log(`🚨 Found ${results.noResponseAlerts?.length || 0} no-response alerts`);
        console.log(`⏰ Found ${results.stuckTickets?.length || 0} stuck tickets`);
        
        return results;
        
    } catch (error) {
        console.error('❌ Daily analysis failed:', error);
        
        // Log error details
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        const errorPath = path.join(__dirname, `error-log-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(errorPath, JSON.stringify(errorLog, null, 2));
        
        throw error;
    }
}

// Set your Claude API key here or in .env file
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'your-claude-api-key-here';

// Run the analysis
runDailyAnalysis()
    .then(() => {
        console.log('🎉 Process completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Process failed:', error.message);
        process.exit(1);
    });