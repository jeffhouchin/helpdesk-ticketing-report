const DailyIntelligenceEngine = require('../../services/dailyIntelligenceEngine');
const Claude4Service = require('../../services/claude4Service');
const AzureSharePointService = require('../../services/azureSharePointService');
const AzureEmailService = require('../../services/azureEmailService');

module.exports = async function (context, req) {
    context.log('🔧 Manual analysis trigger received');
    
    try {
        const claudeService = new Claude4Service();
        const sharePointService = new AzureSharePointService();
        const emailService = new AzureEmailService();
        const analysisEngine = new DailyIntelligenceEngine(claudeService, emailService);

        const csvData = await sharePointService.getTodaysCSV();
        const results = await analysisEngine.runDailyAnalysis(csvData.content);
        
        await emailService.sendDailySupervisorReport(results);
        
        context.res = {
            status: 200,
            body: {
                message: 'Manual analysis completed successfully',
                timestamp: new Date().toISOString(),
                results: results.summary
            }
        };
        
    } catch (error) {
        context.log.error('Manual analysis failed:', error);
        
        context.res = {
            status: 500,
            body: {
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
    }
};