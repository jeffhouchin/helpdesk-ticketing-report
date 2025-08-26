const CSVParser = require('./utils/csvParser');
const ImprovedRecurringDetector = require('./services/improvedRecurringDetector');
const path = require('path');

async function testImprovedRecurring() {
  try {
    console.log('🔄 Starting IMPROVED recurring ticket analysis...\n');

    // Parse the CSV file
    const csvParser = new CSVParser();
    const csvPath = path.join(__dirname, '..', 'Ticket_Data_2025-08-22.csv');
    const tickets = await csvParser.parseTicketCSV(csvPath);

    // Analyze for ACTUAL recurring patterns
    const detector = new ImprovedRecurringDetector();
    const analysis = await detector.analyzeRecurringTickets(tickets);

    // Display results
    console.log('🎯 IMPROVED RECURRING TICKET ANALYSIS:');
    console.log('='.repeat(60));
    
    console.log('\n📊 RECURRING TICKET STATISTICS:');
    const stats = analysis.statistics;
    console.log(`   🔄 Confirmed Recurring: ${stats.totalRecurring}`);
    console.log(`   🤔 Suspicious (Possibly Recurring): ${stats.totalSuspicious}`);
    console.log(`   🦴 Ancient Tickets (1+ year): ${stats.totalAncient}`);
    
    if (stats.oldestTicket) {
      console.log(`   📅 Oldest Ticket: #${stats.oldestTicket.IssueID} (${stats.oldestTicket.recurringAnalysis.ageInYears} years old)`);
    }
    
    if (stats.totalRecurring > 0) {
      console.log(`   📊 Average Recurring Age: ${Math.round(stats.averageRecurringAge/365*10)/10} years`);
    }

    console.log('\n📈 AGE BREAKDOWN:');
    console.log(`   🦕 Over 5 Years: ${stats.recurringByAge.over5Years} tickets`);
    console.log(`   🦴 2-5 Years: ${stats.recurringByAge.over2Years} tickets`);
    console.log(`   📅 1-2 Years: ${stats.recurringByAge.over1Year} tickets`);

    console.log('\n🔄 CONFIRMED RECURRING TICKETS:');
    if (analysis.trueRecurringTickets.length === 0) {
      console.log('   ✅ No confirmed recurring tickets found');
    } else {
      // Sort by age (oldest first)
      const sortedRecurring = analysis.trueRecurringTickets
        .sort((a, b) => b.recurringAnalysis.age - a.recurringAnalysis.age);

      sortedRecurring.forEach(ticket => {
        const analysis_data = ticket.recurringAnalysis;
        const confidence = Math.round(analysis_data.confidence * 100);
        
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        console.log(`   └─ Age: ${analysis_data.ageInYears} years (${analysis_data.age} days)`);
        console.log(`   └─ Type: ${analysis_data.recurringType} | Confidence: ${confidence}%`);
        console.log(`   └─ Tech: ${ticket.Tech_Assigned_Clean || 'UNASSIGNED'}`);
        console.log(`   └─ Status: ${ticket.Current_Status} | Priority: ${ticket.Priority}`);
        console.log('   └─ Evidence:');
        analysis_data.reasons.forEach(reason => {
          console.log(`      • ${reason}`);
        });
        
        // Show creation vs due date if available
        if (ticket.IssueDate && ticket.DueDate) {
          console.log(`   └─ Created: ${ticket.IssueDate.toLocaleDateString()}`);
          console.log(`   └─ Due: ${ticket.DueDate.toLocaleDateString()}`);
        }
        console.log('');
      });
    }

    console.log('🤔 SUSPICIOUS TICKETS (Possibly Recurring):');
    if (analysis.suspiciousTickets.length === 0) {
      console.log('   ✅ No suspicious tickets found');
    } else {
      analysis.suspiciousTickets
        .sort((a, b) => b.recurringAnalysis.age - a.recurringAnalysis.age)
        .slice(0, 10) // Show top 10
        .forEach(ticket => {
          const analysis_data = ticket.recurringAnalysis;
          const confidence = Math.round(analysis_data.confidence * 100);
          
          console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
          console.log(`   └─ Age: ${analysis_data.ageInYears} years | Confidence: ${confidence}%`);
          console.log(`   └─ Tech: ${ticket.Tech_Assigned_Clean || 'UNASSIGNED'}`);
          console.log(`   └─ Main reasons: ${analysis_data.reasons.slice(0, 2).join(', ')}`);
          console.log('');
        });
    }

    console.log('📅 DATE INCONSISTENCY ANALYSIS:');
    if (analysis.dateInconsistencies.length === 0) {
      console.log('   ✅ No significant date inconsistencies found');
    } else {
      console.log(`   ⚠️ Found ${analysis.dateInconsistencies.length} tickets with date inconsistencies:`);
      analysis.dateInconsistencies.slice(0, 5).forEach(ticket => {
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        ticket.dateIssues.issues.forEach(issue => {
          console.log(`   └─ ${issue}`);
        });
        console.log('');
      });
    }

    console.log('🔍 RECURRING TICKET INSIGHTS:');
    
    // Ancient zombie tickets
    const zombies = analysis.trueRecurringTickets.filter(t => 
      t.recurringAnalysis.recurringType === 'ancient_zombie'
    );
    if (zombies.length > 0) {
      console.log(`   🧟 Zombie Tickets: ${zombies.length} tickets over 5 years old`);
      console.log('      → These likely need immediate closure or complete rework');
    }

    // Security recurring tickets
    const securityTickets = analysis.trueRecurringTickets.filter(t => 
      t.recurringAnalysis.recurringType === 'security_recurring'
    );
    if (securityTickets.length > 0) {
      console.log(`   🔒 Security Tickets: ${securityTickets.length} long-running security tasks`);
      console.log('      → Review if these are legitimate ongoing compliance tasks');
    }

    // Extended tasks
    const extendedTasks = analysis.trueRecurringTickets.filter(t => 
      t.recurringAnalysis.recurringType === 'extended_task'
    );
    if (extendedTasks.length > 0) {
      console.log(`   📅 Extended Tasks: ${extendedTasks.length} tasks with repeatedly changed due dates`);
      console.log('      → May indicate scope creep or resource issues');
    }

    console.log('\n💡 RECOMMENDATIONS FOR RECURRING TICKETS:');
    const recommendations = [];

    if (stats.totalRecurring > 0) {
      recommendations.push(`🔄 Review ${stats.totalRecurring} confirmed recurring tickets for closure or redefinition`);
    }

    if (zombies.length > 0) {
      recommendations.push(`🧟 Immediate action needed on ${zombies.length} zombie tickets over 5 years old`);
    }

    if (stats.totalSuspicious > 5) {
      recommendations.push(`🤔 Investigate ${stats.totalSuspicious} suspicious tickets - may be hidden recurring issues`);
    }

    if (analysis.dateInconsistencies.length > 10) {
      recommendations.push(`📅 Review date management - ${analysis.dateInconsistencies.length} tickets have suspicious date patterns`);
    }

    if (recommendations.length === 0) {
      console.log('   ✅ Recurring ticket patterns look healthy');
    } else {
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }

    console.log('\n✅ Improved recurring analysis complete!');
    console.log('\n📋 SUMMARY FOR DAILY REPORTING:');
    console.log(`   • ${stats.totalRecurring} tickets are confirmed recurring (reused ticket IDs)`);
    console.log(`   • These should be treated differently in SLA analysis`);
    console.log(`   • Oldest recurring ticket: ${stats.oldestTicket ? `#${stats.oldestTicket.IssueID} (${stats.oldestTicket.recurringAnalysis.ageInYears} years)` : 'None'}`);

  } catch (error) {
    console.error('❌ Error during improved recurring analysis:', error);
  }
}

// Run the test
testImprovedRecurring();