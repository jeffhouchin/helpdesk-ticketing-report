const { app } = require('@azure/functions');

// Simple test function to verify deployment
app.http('test', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('Test function executed');
        return { 
            status: 200,
            body: "Azure Functions v4 is working!" 
        };
    }
});

// Manual Supervisor Dashboard Trigger (for testing)
app.http('triggerSupervisorDashboard', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('🔧 Manual supervisor dashboard trigger received');
        
        try {
            const AzureSharePointService = require('./services/azureSharePointService');
            const DataProcessor = require('./modules/dataProcessor');
            const SupervisorDashboardService = require('./services/supervisorDashboardService');
            const EmailDispatcher = require('./modules/emailDispatcher');

            context.log('📊 Fetching latest ticket data from SharePoint...');
            const sharePointService = new AzureSharePointService();
            const csvData = await sharePointService.getLatestTicketCSV();
            
            context.log('🔍 Processing ticket data...');
            const dataProcessor = new DataProcessor();
            const processedData = await dataProcessor.processCSVContent(csvData.content, csvData.filename);
            
            context.log('📈 Generating supervisor dashboard...');
            const supervisorService = new SupervisorDashboardService();
            const supervisorReport = await supervisorService.generateSupervisorDailyReport(processedData);
            
            const subject = `📋 Manual Helpdesk Supervisor Dashboard - ${new Date().toLocaleDateString()}`;
            
            context.log('📧 Sending supervisor dashboard...');
            const emailDispatcher = new EmailDispatcher();
            await emailDispatcher.sendSupervisorDashboard(supervisorReport, subject);
            
            return {
                status: 200,
                body: {
                    message: 'Supervisor dashboard sent successfully',
                    timestamp: new Date().toISOString()
                }
            };
            
        } catch (error) {
            context.log('Manual supervisor dashboard failed:', error);
            
            return {
                status: 500,
                body: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});

// Daily Supervisor Dashboard Timer - Runs at 7:30 AM Eastern Time every day
app.timer('dailySupervisorDashboard', {
    schedule: '0 30 11 * * *', // 11:30 UTC = 7:30 AM EDT (daylight time) / 12:30 UTC = 7:30 AM EST (standard time)
    handler: async (myTimer, context) => {
        context.log('⏰ Daily supervisor dashboard timer triggered at:', new Date().toISOString());
        
        try {
            const AzureSharePointService = require('./services/azureSharePointService');
            const DataProcessor = require('./modules/dataProcessor');
            const SupervisorDashboardService = require('./services/supervisorDashboardService');
            const EmailDispatcher = require('./modules/emailDispatcher');

            context.log('📊 Fetching latest ticket data from SharePoint...');
            const sharePointService = new AzureSharePointService();
            const csvData = await sharePointService.getLatestTicketCSV();
            
            context.log('🔍 Processing ticket data...');
            const dataProcessor = new DataProcessor();
            const processedData = await dataProcessor.processCSVContent(csvData.content, csvData.filename);
            
            context.log('📈 Generating supervisor dashboard...');
            const supervisorService = new SupervisorDashboardService();
            const supervisorReport = await supervisorService.generateSupervisorDailyReport(processedData);
            
            const subject = `📋 Daily Supervisor Dashboard - ${new Date().toLocaleDateString()}`;
            
            context.log('📧 Sending supervisor dashboard...');
            const emailDispatcher = new EmailDispatcher();
            await emailDispatcher.sendSupervisorDashboard(supervisorReport, subject);
            
            context.log('✅ Daily supervisor dashboard completed successfully');
            
        } catch (error) {
            context.log('❌ Daily supervisor dashboard failed:', error);
            
            // Send error notification
            const EmailDispatcher = require('./modules/emailDispatcher');
            const emailDispatcher = new EmailDispatcher();
            await emailDispatcher.sendErrorNotification(error, 'Daily Supervisor Dashboard Timer');
        }
    }
});

// Random Ticket Review Timer - Runs every 60 minutes and randomly selects tickets for training
app.timer('randomTicketReview', {
    schedule: '0 0 * * * *', // Every 60 minutes (top of each hour)
    handler: async (myTimer, context) => {
        context.log('🎲 Random ticket review timer triggered at:', new Date().toISOString());
        
        // 70% chance to run each hour
        const shouldRun = Math.random() <= 0.7; // 70% chance to run
        if (!shouldRun) {
            context.log('Skipping this cycle for randomness');
            return;
        }
        
        try {
            const AzureSharePointService = require('./services/azureSharePointService');
            const DataProcessor = require('./modules/dataProcessor');
            const TechnicianTrainingService = require('./services/technicianTrainingService');
            const EmailDispatcher = require('./modules/emailDispatcher');

            context.log('📊 Fetching latest ticket data from SharePoint...');
            const sharePointService = new AzureSharePointService();
            const csvData = await sharePointService.getLatestTicketCSV();
            
            context.log('🔍 Processing ticket data...');
            const dataProcessor = new DataProcessor();
            const processedData = await dataProcessor.processCSVContent(csvData.content, csvData.filename);
            
            // Select random ticket for review
            const trainingService = new TechnicianTrainingService();
            const selectedTicket = await trainingService.selectRandomTicketForReview(processedData);
            
            if (!selectedTicket) {
                context.log('No eligible tickets for review');
                return;
            }
            
            context.log(`📝 Grading ticket #${selectedTicket.IssueID}...`);
            const gradeDetails = await trainingService.gradeTicketForTraining(selectedTicket);
            
            // Generate training email
            const emailContent = await trainingService.generateTrainingEmail(gradeDetails);
            
            // Get emails for all technicians involved
            const techEmails = [];
            for (const techName of gradeDetails.allTechnicians) {
                const email = await trainingService.getTechnicianEmail(techName);
                if (email && !email.includes('DEFAULT')) {
                    techEmails.push({ name: techName, email: email });
                }
            }
            
            if (techEmails.length === 0) {
                context.log(`⚠️ No valid emails found for technicians on ticket #${selectedTicket.IssueID}`);
                return;
            }
            
            context.log(`📧 Sending training feedback to ${techEmails.length} technician(s)...`);
            const emailDispatcher = new EmailDispatcher();
            
            // Send to all involved technicians
            for (const tech of techEmails) {
                context.log(`  → Sending to ${tech.name} (${tech.email})`);
                await emailDispatcher.sendEmail(
                    tech.email,
                    emailContent.subject,
                    emailContent.html
                );
            }
            
            context.log(`✅ Training review sent for ticket #${selectedTicket.IssueID} (Grade: ${gradeDetails.grade}) to ${techEmails.length} technician(s)`);
            
        } catch (error) {
            context.log('❌ Random ticket review failed:', error);
        }
    }
});