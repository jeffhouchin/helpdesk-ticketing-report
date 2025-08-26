// Simple local test for executive summary only
const DailyIntelligenceEngine = require('./src/services/dailyIntelligenceEngine');
const fs = require('fs');
const path = require('path');

async function testExecutiveSummary() {
    console.log('🧪 Testing Executive Summary Locally...');
    
    try {
        // Load local CSV file (latest from SharePoint)
        const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-25.csv');
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        const csvContent = fs.readFileSync(csvPath, 'utf8');
        console.log(`📊 Loaded CSV file: ${csvContent.length} characters`);
        
        // Initialize analysis engine with mock email service
        const mockEmailService = {
            sendEmail: async () => ({ success: true }),
            sendDailySupervisorReport: async () => ({ success: true })
        };
        const analysisEngine = new DailyIntelligenceEngine(null, mockEmailService);
        
        // Run analysis
        console.log('🔍 Running analysis...');
        const results = await analysisEngine.runDailyIntelligenceFromContent(csvContent, 'Ticket_Data_2025-08-22.csv');
        
        // Print executive summary
        console.log('\n📊 EXECUTIVE SUMMARY:');
        console.log('========================');
        console.log(`📁 File: ${results.debug?.filename || 'Unknown'}`);
        console.log(`📏 CSV Size: ${results.debug?.csvFileSize || 0} characters`);
        console.log(`🎫 Total Tickets Parsed: ${results.debug?.totalTicketsParsed || 0}`);
        console.log(`🟢 Open Tickets Found: ${results.debug?.openTicketsFound || 0}`);
        console.log(`🔴 Closed Yesterday: ${results.debug?.closedYesterdayFound || 0}`);
        
        if (results.summary) {
            console.log('\n📈 DAILY OVERVIEW:');
            console.log(`   Total Open: ${results.summary.totalOpen || 0}`);
            console.log(`   Unassigned: ${results.summary.unassigned || 0}`);
            console.log(`   New Today: ${results.summary.newToday || 0}`);
            console.log(`   High Priority: ${results.summary.highPriority || 0}`);
            
            if (results.summary.statusBreakdown) {
                console.log('\n📋 STATUS BREAKDOWN:');
                Object.entries(results.summary.statusBreakdown).forEach(([status, count]) => {
                    console.log(`   ${status}: ${count}`);
                });
            }
            
            if (results.summary.technicianWorkload) {
                console.log('\n👥 TECHNICIAN WORKLOAD:');
                Object.entries(results.summary.technicianWorkload).forEach(([tech, count]) => {
                    console.log(`   ${tech}: ${count}`);
                });
            }
        }
        
        console.log('\n🚨 ALERTS:');
        console.log(`   No Response (72+ hrs): ${results.noResponseAlerts?.length || 0}`);
        console.log(`   Stuck Tickets (14+ days): ${results.stuckTickets?.length || 0}`);
        
        // Save results for inspection
        const outputPath = path.join(__dirname, 'test-results.json');
        fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
        console.log(`\n💾 Full results saved to: ${outputPath}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testExecutiveSummary();