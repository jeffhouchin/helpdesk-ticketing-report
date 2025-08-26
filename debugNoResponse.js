// Debug script to test no-response detection
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const DailyIntelligenceEngine = require('./src/services/dailyIntelligenceEngine');

async function debugNoResponse() {
    console.log('🔍 Debugging No-Response Detection...\n');
    
    // Load CSV
    const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-25.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV  
    const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true
    });
    
    console.log(`📊 Loaded ${records.length} tickets`);
    
    // Initialize intelligence engine
    const engine = new DailyIntelligenceEngine();
    
    // Clean records and filter open tickets
    const openTickets = records
        .map(record => {
            const cleaned = {};
            Object.keys(record).forEach(key => {
                const cleanKey = key.replace(/^\uFEFF/, '').trim();
                cleaned[cleanKey] = record[key];
            });
            return cleaned;
        })
        .filter(ticket => {
            const status = (ticket.Current_Status || '').toLowerCase();
            return !['closed', 'resolved', 'completed'].some(s => status.includes(s));
        });
        
    console.log(`📋 Found ${openTickets.length} open tickets`);
    
    // Test the first 5 tickets manually
    console.log('\n🔍 DETAILED ANALYSIS OF FIRST 5 TICKETS:');
    console.log('===========================================');
    
    for (let i = 0; i < Math.min(5, openTickets.length); i++) {
        const ticket = openTickets[i];
        console.log(`\n📋 TICKET #${ticket.IssueID}:`);
        console.log(`   Issue Date: ${ticket.IssueDate}`);
        console.log(`   Tech Assigned: "${ticket.Tech_Assigned || 'UNASSIGNED'}"`);
        console.log(`   Status: ${ticket.Current_Status}`);
        
        const daysSinceCreated = engine.businessDays.getBusinessDaysSince(ticket.IssueDate);
        console.log(`   Days Old: ${daysSinceCreated}`);
        
        const lastTechResponse = engine.getLastTechResponse(ticket);
        console.log(`   Tech Response: ${lastTechResponse ? 'YES' : 'NO'}`);
        
        if (lastTechResponse) {
            console.log(`   Last Response Date: ${lastTechResponse.date}`);
            console.log(`   Response Content: ${lastTechResponse.content.substring(0, 100)}...`);
        }
        
        if (ticket.comments) {
            console.log(`   Comments (first 200 chars): ${ticket.comments.substring(0, 200)}...`);
        } else {
            console.log(`   Comments: NONE`);
        }
        
        // Test criteria
        const meetsCriteria = daysSinceCreated >= 1 && (!lastTechResponse || engine.businessDays.getBusinessDaysSince(lastTechResponse.date) >= 1);
        console.log(`   🚨 SHOULD ALERT: ${meetsCriteria ? 'YES' : 'NO'}`);
    }
    
    console.log('\n🧪 Running actual no-response detection...');
    const alerts = await engine.identify72HourNoResponse(openTickets);
    console.log(`🚨 ALERTS FOUND: ${alerts.length}`);
    
    if (alerts.length > 0) {
        console.log('\nAlert details:');
        alerts.slice(0, 3).forEach(alert => {
            console.log(`  - Ticket #${alert.ticket.IssueID}: ${alert.daysSinceCreated} days old`);
        });
    }
}

debugNoResponse().catch(console.error);