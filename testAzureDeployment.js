const DailyIntelligenceEngine = require('./src/services/dailyIntelligenceEngine');
const Claude4Service = require('./src/services/claude4Service');
const AzureEmailService = require('./src/services/azureEmailService');
const fs = require('fs');
const path = require('path');

async function testSystem() {
    console.log('🧪 Testing Helpdesk Intelligence System...');
    
    try {
        // Initialize services
        const claudeService = new Claude4Service();
        const emailService = new AzureEmailService();
        const analysisEngine = new DailyIntelligenceEngine(claudeService, emailService);

        // Use the existing CSV file for testing
        const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-22.csv');
        
        if (!fs.existsSync(csvPath)) {
            console.log('❌ Test CSV file not found');
            return;
        }

        const csvContent = fs.readFileSync(csvPath, 'utf8');
        console.log('📊 Loaded test CSV data');

        // Run analysis
        console.log('🧠 Running AI analysis...');
        const results = await analysisEngine.runDailyAnalysis(csvContent);
        
        console.log('✅ Analysis completed successfully!');
        console.log('📈 Results Summary:');
        console.log(`- Total tickets analyzed: ${results.summary?.totalTickets || 0}`);
        console.log(`- No response alerts: ${results.noResponseAlerts?.length || 0}`);
        console.log(`- Stuck tickets: ${results.stuckTickets?.length || 0}`);
        
        // Test email sending
        console.log('📧 Testing email functionality...');
        await emailService.sendDailySupervisorReport(results);
        
        console.log('🎉 System test completed successfully!');
        console.log('Your helpdesk intelligence system is working correctly.');
        
    } catch (error) {
        console.error('❌ System test failed:', error);
    }
}

// Set environment variables for testing
process.env.CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'your-api-key-here';
process.env.SUPERVISOR_EMAILS = 'jhouchin@banyancenters.com,rmoll@banyancenters.com,cbowra@banyancenters.com';

testSystem();