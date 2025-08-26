// Test the DataProcessor no-response detection
const fs = require('fs');
const path = require('path');
const DataProcessor = require('./src/modules/dataProcessor');

async function testDataProcessor() {
    console.log('🧪 Testing DataProcessor no-response detection...\n');
    
    const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-25.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    const processor = new DataProcessor();
    
    try {
        const result = await processor.processCSVContent(csvContent, 'test.csv');
        
        console.log(`📊 Processing Results:`);
        console.log(`   Total Records: ${result.totalRecords}`);
        console.log(`   Open Tickets: ${result.openTickets.length}`);
        console.log(`   No Response Alerts: ${result.noResponseAlerts?.length || 0}`);
        console.log(`   Stuck Tickets: ${result.stuckTickets?.length || 0}`);
        
        if (result.noResponseAlerts && result.noResponseAlerts.length > 0) {
            console.log('\n🚨 First 5 No Response Alerts:');
            result.noResponseAlerts.slice(0, 5).forEach(alert => {
                console.log(`   Ticket #${alert.ticket.IssueID}: ${alert.daysSinceCreated} days old`);
                if (alert.lastTechResponse) {
                    console.log(`     Last tech response: ${alert.lastTechResponse.date}`);
                } else {
                    console.log(`     Last tech response: NONE`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDataProcessor();