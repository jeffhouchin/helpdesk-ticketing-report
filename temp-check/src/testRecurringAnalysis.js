const CSVParser = require('./utils/csvParser');
const RecurringTicketDetector = require('./services/recurringTicketDetector');
const path = require('path');

async function testRecurringAnalysis() {
  try {
    console.log('🔄 Starting RECURRING TICKET analysis...\n');

    // Parse the CSV file
    const csvParser = new CSVParser();
    const csvPath = path.join(__dirname, '..', 'Ticket_Data_2025-08-22.csv');
    const tickets = await csvParser.parseTicketCSV(csvPath);

    // Analyze for recurring patterns
    const detector = new RecurringTicketDetector();
    const analysis = await detector.analyzeRecurringTickets(tickets);

    // Display results
    console.log('🎯 RECURRING TICKET ANALYSIS RESULTS:');
    console.log('='.repeat(60));
    
    console.log('\n📊 RECURRING TICKET SUMMARY:');
    console.log(`   🔄 Total Recurring Tickets: ${analysis.statistics.totalRecurring}`);
    console.log(`   📋 Ticket Families Found: ${Object.keys(analysis.potentialRecurring).length}`);
    if (analysis.statistics.oldestRecurring) {
      console.log(`   📅 Oldest Recurring Ticket: #${analysis.statistics.oldestRecurring.IssueID} (${analysis.statistics.oldestRecurring.recurringInfo.age} days)`);
    }
    if (analysis.statistics.mostFrequentIssue) {
      console.log(`   🏆 Most Frequent Issue: ${analysis.statistics.mostFrequentIssue.type} (${analysis.statistics.mostFrequentIssue.count} tickets)`);
    }

    console.log('\n🔄 RECURRING TICKET CATEGORIES:');
    Object.entries(analysis.statistics.recurringByType).forEach(([type, count]) => {
      console.log(`   📂 ${type.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${count} tickets`);
    });

    console.log('\n🚨 IDENTIFIED RECURRING TICKETS:');
    if (analysis.recurringTickets.length === 0) {
      console.log('   ✅ No recurring tickets identified');
    } else {
      // Sort by confidence and age
      const sortedRecurring = analysis.recurringTickets
        .sort((a, b) => b.recurringInfo.confidence - a.recurringInfo.confidence || b.recurringInfo.age - a.recurringInfo.age)
        .slice(0, 15); // Show top 15

      sortedRecurring.forEach(ticket => {
        const confidence = Math.round(ticket.recurringInfo.confidence * 100);
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        console.log(`   └─ Type: ${ticket.recurringInfo.patternType} | Confidence: ${confidence}% | Age: ${ticket.recurringInfo.age} days`);
        console.log(`   └─ Reasons: ${ticket.recurringInfo.reasons.join(', ')}`);
        console.log(`   └─ Submitter: ${ticket.Submitted_By}`);
        console.log(`   └─ Tech: ${ticket.Tech_Assigned_Clean || 'UNASSIGNED'}`);
        console.log('');
      });
    }

    console.log('👥 POTENTIAL TICKET FAMILIES (Similar Issues):');
    if (analysis.potentialRecurring.length === 0) {
      console.log('   ✅ No ticket families detected');
    } else {
      analysis.potentialRecurring
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .forEach(family => {
          console.log(`   📁 Family: "${family.familyKey}"`);
          console.log(`   └─ Count: ${family.count} tickets`);
          console.log(`   └─ Pattern: ${family.pattern.type} (${family.pattern.frequency})`);
          console.log(`   └─ Date Range: ${family.dateRange.span} days`);
          console.log('   └─ Tickets:');
          family.tickets.slice(0, 3).forEach(ticket => {
            console.log(`      • #${ticket.IssueID}: ${ticket.Subject || 'No subject'}`);
          });
          if (family.tickets.length > 3) {
            console.log(`      • ... and ${family.tickets.length - 3} more`);
          }
          console.log('');
        });
    }

    console.log('🎯 RECURRING TICKET INSIGHTS:');
    
    // System-generated recurring tickets
    const systemRecurring = analysis.recurringTickets.filter(t => t.recurringInfo.isSystemGenerated);
    if (systemRecurring.length > 0) {
      console.log(`   🤖 System-Generated: ${systemRecurring.length} tickets are automated recurring alerts`);
      console.log('      → Consider automated resolution or alert threshold adjustment');
    }

    // Camera/Network issues specifically
    const cameraIssues = analysis.recurringGroups.cameraAlerts || [];
    if (cameraIssues.length > 0) {
      console.log(`   📹 Camera Issues: ${cameraIssues.length} recurring camera connection problems`);
      console.log('      → May indicate network infrastructure issues needing permanent fix');
    }

    // Very old recurring tickets
    const ancientTickets = analysis.recurringTickets.filter(t => t.recurringInfo.age > 100);
    if (ancientTickets.length > 0) {
      console.log(`   🦴 Ancient Tickets: ${ancientTickets.length} tickets over 100 days old are likely zombie tickets`);
      console.log('      → Strong candidates for immediate closure or escalation');
    }

    console.log('\n💡 RECOMMENDATIONS:');
    const recommendations = [];

    if (systemRecurring.length > 5) {
      recommendations.push('🤖 High volume of system alerts - review monitoring thresholds');
    }

    if (cameraIssues.length > 0) {
      recommendations.push('📹 Camera connection issues recurring - investigate network infrastructure');
    }

    if (analysis.statistics.totalRecurring > analysis.statistics.totalRecurring * 0.2) {
      recommendations.push('🔄 High recurring ticket rate - may indicate underlying systemic issues');
    }

    if (ancientTickets.length > 0) {
      recommendations.push(`🧹 ${ancientTickets.length} zombie tickets need immediate cleanup`);
    }

    if (recommendations.length === 0) {
      console.log('   ✅ Recurring ticket patterns look healthy');
    } else {
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }

    console.log('\n✅ Recurring analysis complete!');

  } catch (error) {
    console.error('❌ Error during recurring analysis:', error);
  }
}

// Run the test
testRecurringAnalysis();