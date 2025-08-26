// Clean Supervisor Dashboard System - Azure Functions v4
const { app } = require('@azure/functions');
const AzureSharePointService = require('./services/azureSharePointService');
const SupervisorDashboardService = require('./services/supervisorDashboardService');
const EmailDispatcher = require('./modules/emailDispatcher');
const DataProcessor = require('./modules/dataProcessor');

// Azure Function - Daily Supervisor Dashboard (Timer Trigger)
app.timer('supervisorDashboard', {
    schedule: '0 30 6 * * *', // 6:30 AM daily
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
            const csvData = await sharePointService.getTodaysCSV();
            
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
            const csvData = await sharePointService.getTodaysCSV();
            
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
                        aiModelUsed: 'claude-3-5-haiku-20241022',
                        criticalActions: supervisorReport.summary.criticalActions
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

