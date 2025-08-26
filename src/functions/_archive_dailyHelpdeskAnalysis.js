const { app } = require('@azure/functions');
const DailyIntelligenceEngine = require('../services/dailyIntelligenceEngine');
const Claude4Service = require('../services/claude4Service');
const AzureSharePointService = require('../services/azureSharePointService');
const AzureEmailService = require('../services/azureEmailService');

// Azure Function that runs daily at 6:30 AM
app.timer('dailyHelpdeskAnalysis', {
    // Run at 6:30 AM every day (0 30 6 * * *)
    schedule: '0 30 6 * * *',
    handler: async (myTimer, context) => {
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
            
            // Send supervisor reports only (individual reviews disabled)
            context.log('📧 Sending supervisor reports...');
            await emailService.sendDailySupervisorReport(results);
            
            // Upload results to SharePoint for record keeping
            const today = new Date().toISOString().split('T')[0];
            await sharePointService.uploadAnalysisResults(results, `Analysis_${today}.json`);
            
            context.log('✅ Daily analysis completed successfully');
            
            return {
                status: 200,
                body: {
                    message: 'Daily analysis completed',
                    timestamp: new Date().toISOString(),
                    ticketsAnalyzed: results.summary?.totalTickets || 0,
                    stuckTickets: results.stuckTickets?.length || 0,
                    noResponseAlerts: results.noResponseAlerts?.length || 0
                }
            };
            
        } catch (error) {
            context.log.error('❌ Daily analysis failed:', error);
            
            // Send error notification to supervisors
            try {
                const emailService = new AzureEmailService();
                await emailService.sendErrorNotification(error, 'Daily Helpdesk Analysis');
            } catch (emailError) {
                context.log.error('Failed to send error notification:', emailError);
            }
            
            throw error;
        }
    }
});

// Manual trigger endpoint for testing
app.http('triggerAnalysis', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('🔧 Manual analysis trigger received');
        
        try {
            // Same logic as timer function
            const claudeService = new Claude4Service();
            const sharePointService = new AzureSharePointService();
            const emailService = new AzureEmailService();
            const analysisEngine = new DailyIntelligenceEngine(claudeService, emailService);

            const csvData = await sharePointService.getTodaysCSV();
            const results = await analysisEngine.runDailyAnalysis(csvData.content);
            
            await emailService.sendDailySupervisorReport(results);
            
            return {
                status: 200,
                jsonBody: {
                    message: 'Manual analysis completed successfully',
                    timestamp: new Date().toISOString(),
                    results: results.summary
                }
            };
            
        } catch (error) {
            context.log.error('Manual analysis failed:', error);
            
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