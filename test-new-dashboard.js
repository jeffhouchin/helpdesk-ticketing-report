// Test the new supervisor dashboard locally
const DataProcessor = require('./src/modules/dataProcessor');
const SupervisorDashboardService = require('./src/services/supervisorDashboardService');
const fs = require('fs');
const path = require('path');

async function testNewDashboard() {
    console.log('🧪 Testing new actionable supervisor dashboard...\n');
    
    const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-25.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    const processor = new DataProcessor();
    const supervisorService = new SupervisorDashboardService();
    
    try {
        // Process data
        const processedData = await processor.processCSVContent(csvContent, 'test.csv');
        
        // Generate new dashboard
        const dashboard = await supervisorService.generateSupervisorDailyReport(processedData);
        
        console.log(`📊 New Dashboard Summary:`);
        console.log(`   Total Open: ${dashboard.summary.totalOpen}`);
        console.log(`   SLA Violations: ${dashboard.summary.slaViolations}`);
        console.log(`   Critical Aging (22+ days): ${dashboard.summary.criticalAging}`);
        console.log(`   Immediate Triage: ${dashboard.summary.immediateTriage}`);
        console.log(`   VIP Alerts: ${dashboard.summary.vipAlerts}`);
        console.log(`   Quick Wins: ${dashboard.summary.quickWins}`);
        console.log(`   Closure Candidates: ${dashboard.summary.closureCandidates}`);
        
        console.log(`\n📋 Sections Preview:`);
        
        if (dashboard.sections.aging_analysis) {
            console.log(`   Aging Buckets:`, dashboard.sections.aging_analysis.summary);
        }
        
        if (dashboard.sections.immediate_triage && dashboard.sections.immediate_triage.length > 0) {
            console.log(`   First Triage Item:`, dashboard.sections.immediate_triage[0]);
        }
        
        if (dashboard.sections.tech_performance) {
            const techs = Object.keys(dashboard.sections.tech_performance);
            console.log(`   Tech Performance (${techs.length} technicians):`, techs.slice(0, 3));
        }
        
        // Save for inspection
        fs.writeFileSync('new-dashboard-test.json', JSON.stringify(dashboard, null, 2));
        console.log(`\n💾 Full dashboard saved to new-dashboard-test.json`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

testNewDashboard();