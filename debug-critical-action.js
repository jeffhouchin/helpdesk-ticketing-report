// Debug the critical action detection
const DataProcessor = require('./src/modules/dataProcessor');
const SupervisorDashboardService = require('./src/services/supervisorDashboardService');
const fs = require('fs');
const path = require('path');

async function debugCriticalActions() {
    console.log('🔍 Debugging critical action detection...\n');
    
    const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-25.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    const processor = new DataProcessor();
    const supervisorService = new SupervisorDashboardService();
    
    // Process data
    const processedData = await processor.processCSVContent(csvContent, 'debug.csv');
    
    console.log(`📊 Data Summary:`);
    console.log(`   Total tickets: ${processedData.openTickets.length}`);
    console.log(`   No response alerts: ${processedData.noResponseAlerts?.length || 0}`);
    console.log(`   Unassigned tickets: ${processedData.openTickets.filter(t => !t.Tech_Assigned_Clean || t.Tech_Assigned_Clean.trim() === '').length}`);
    
    // Generate supervisor analysis
    const supervisorReport = await supervisorService.generateSupervisorDailyReport(processedData);
    
    console.log(`\n🎯 Critical Actions Analysis:`);
    console.log(`   Critical actions count: ${supervisorReport.summary.criticalActions}`);
    console.log(`   Daily priorities:`, supervisorReport.analysis.daily_priorities);
    
    // Check the specific new ticket
    const newTicket = processedData.openTickets.find(t => t.IssueID === '135036');
    if (newTicket) {
        const ticketAge = supervisorService.calculateAge(newTicket.IssueDate);
        console.log(`\n🆕 New Ticket #135036:`);
        console.log(`   Created: ${newTicket.IssueDate}`);
        console.log(`   Age in days: ${ticketAge}`);
        console.log(`   Tech assigned: "${newTicket.Tech_Assigned_Clean || 'NONE'}"`);
        console.log(`   Is in no-response alerts: ${processedData.noResponseAlerts.some(alert => alert.ticket.IssueID === '135036')}`);
    }
}

debugCriticalActions().catch(console.error);