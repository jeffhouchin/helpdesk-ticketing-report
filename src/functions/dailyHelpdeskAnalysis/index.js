const DailyIntelligenceEngine = require('../../services/dailyIntelligenceEngine');
const Claude4Service = require('../../services/claude4Service');
const AzureSharePointService = require('../../services/azureSharePointService');
const AzureEmailService = require('../../services/azureEmailService');

module.exports = async function (context, myTimer) {
    context.log('🚀 Daily Helpdesk Intelligence Analysis Started');
    
    try {
        // Initialize services
        const claudeService = new Claude4Service();
        const sharePointService = new AzureSharePointService();
        const emailService = new AzureEmailService();
        const analysisEngine = new DailyIntelligenceEngine(claudeService, emailService);

        // Get today's CSV data from SharePoint
        context.log('📊 Fetching latest ticket data from SharePoint...');
        const csvData = await sharePointService.getTodaysCSV();
        
        // Run full analysis
        context.log('🧠 Running AI analysis...');
        const results = await analysisEngine.runDailyAnalysis(csvData.content);
        
        // Send supervisor reports
        context.log('📧 Sending supervisor reports...');
        await emailService.sendDailySupervisorReport(results);
        
        // Upload results to SharePoint
        const today = new Date().toISOString().split('T')[0];
        await sharePointService.uploadAnalysisResults(results, `Analysis_${today}.json`);
        
        context.log('✅ Daily analysis completed successfully');
        
        return {
            status: 200,
            body: {
                message: 'Daily analysis completed',
                timestamp: new Date().toISOString(),
                ticketsAnalyzed: results.summary?.totalTickets || 0
            }
        };
        
    } catch (error) {
        context.log('❌ Daily analysis failed:', error);
        
        // Send error notification
        try {
            const emailService = new AzureEmailService();
            await emailService.sendErrorNotification(error, 'Daily Helpdesk Analysis');
        } catch (emailError) {
            context.log('Failed to send error notification:', emailError);
        }
        
        throw error;
    }
};