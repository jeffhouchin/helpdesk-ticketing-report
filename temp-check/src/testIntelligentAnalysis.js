const CSVParser = require('./utils/csvParser');
const IntelligentTicketAnalyzer = require('./services/intelligentTicketAnalyzer');
const path = require('path');

async function testIntelligentAnalysis() {
  try {
    console.log('🧠 Starting INTELLIGENT ticket analysis...\n');

    // Parse the CSV file
    const csvParser = new CSVParser();
    const csvPath = path.join(__dirname, '..', 'Ticket_Data_2025-08-22.csv');
    const tickets = await csvParser.parseTicketCSV(csvPath);

    // Run intelligent analysis
    const analyzer = new IntelligentTicketAnalyzer();
    const analysis = await analyzer.analyzeTickets(tickets);

    // Display intelligent results
    console.log('🎯 INTELLIGENT ANALYSIS RESULTS:');
    console.log('='.repeat(60));
    
    console.log('\n📊 EXECUTIVE SUMMARY:');
    const summary = analysis.summary;
    console.log(`   📋 Total Open Tickets: ${summary.totalOpen}`);
    console.log(`   🚨 Need Immediate Attention: ${summary.needsAttention}`);
    console.log(`   ⚡ Quick Wins Available: ${summary.quickWins}`);
    console.log(`   📈 SLA Compliance: ${summary.slaCompliance}%`);
    console.log(`   ⏱️  Average Ticket Age: ${summary.avgTicketAge} business days`);
    console.log(`   👥 Active Technicians: ${summary.totalTechnicians}`);
    console.log(`   ⚖️  Average Load per Tech: ${summary.avgTechLoad} tickets`);

    console.log('\n🚨 IMMEDIATE ACTIONS REQUIRED:');
    if (analysis.immediateActions.length === 0) {
      console.log('   ✅ No immediate actions required - team is on track!');
    } else {
      analysis.immediateActions.forEach((action, index) => {
        console.log(`   ${index + 1}. [${action.priority.toUpperCase()}] ${action.action}`);
        console.log(`      📊 Count: ${action.count} tickets`);
        console.log(`      📝 ${action.description}`);
        console.log('      🎫 Top tickets:');
        action.tickets.slice(0, 3).forEach(ticket => {
          console.log(`         #${ticket.IssueID}: ${ticket.Subject || 'No subject'}`);
          console.log(`         └─ ${ticket.actionRequired.message}`);
        });
        console.log('');
      });
    }

    console.log('⚡ QUICK WIN OPPORTUNITIES:');
    const topQuickWins = analysis.quickWins
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 8);
    
    if (topQuickWins.length === 0) {
      console.log('   No quick wins identified with current criteria');
    } else {
      topQuickWins.forEach(ticket => {
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        console.log(`   └─ ${ticket.category.reason} | ${ticket.ticketAge} business days old | Score: ${ticket.urgencyScore}`);
        console.log(`   └─ Assigned to: ${ticket.Tech_Assigned_Clean || 'UNASSIGNED'}`);
      });
    }

    console.log('\n🔴 TICKETS NEEDING ATTENTION:');
    const criticalTickets = analysis.needsAttention
      .filter(t => t.actionRequired.severity === 'critical')
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 10);
    
    if (criticalTickets.length === 0) {
      console.log('   ✅ No critical tickets - great job team!');
    } else {
      criticalTickets.forEach(ticket => {
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        console.log(`   └─ 🚨 ${ticket.actionRequired.message}`);
        console.log(`   └─ Age: ${ticket.ticketAge} business days | Urgency: ${ticket.urgencyScore}/100`);
        console.log(`   └─ Tech: ${ticket.Tech_Assigned_Clean || 'UNASSIGNED'}`);
        console.log('');
      });
    }

    console.log('📋 ESCALATION CANDIDATES:');
    if (analysis.escalationCandidates.length === 0) {
      console.log('   ✅ No tickets requiring escalation');
    } else {
      analysis.escalationCandidates.slice(0, 5).forEach(ticket => {
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        console.log(`   └─ ${ticket.escalationReason}`);
        console.log(`   └─ Assigned to: ${ticket.Tech_Assigned_Clean}`);
        console.log('');
      });
    }

    console.log('👥 TECHNICIAN WORKLOAD ANALYSIS:');
    const techAnalysis = Object.entries(analysis.technicianAnalysis)
      .sort(([,a], [,b]) => b.needsAttention - a.needsAttention || b.totalTickets - a.totalTickets)
      .slice(0, 8);

    techAnalysis.forEach(([tech, data]) => {
      const alertIcon = data.needsAttention > 5 ? '🚨' : data.needsAttention > 2 ? '⚠️' : '✅';
      console.log(`   ${alertIcon} ${tech}:`);
      console.log(`      📋 Total: ${data.totalTickets} | ⚠️ Need Attention: ${data.needsAttention} | ⚡ Quick Wins: ${data.quickWins}`);
      console.log(`      📊 Avg Age: ${data.avgAge.toFixed(1)} days | 🕒 Oldest: ${data.oldestTicket ? data.oldestTicket.ticketAge + ' days' : 'N/A'}`);
      if (data.needsAttention > 0) {
        const urgentTickets = data.tickets
          .filter(t => t.actionRequired.severity === 'critical')
          .slice(0, 2);
        urgentTickets.forEach(ticket => {
          console.log(`      └─ 🚨 #${ticket.IssueID}: ${ticket.actionRequired.message}`);
        });
      }
      console.log('');
    });

    console.log('⚙️ PROCESS ISSUES IDENTIFIED:');
    if (analysis.processIssues.length === 0) {
      console.log('   ✅ No systemic process issues detected');
    } else {
      analysis.processIssues.forEach(issue => {
        const icon = issue.severity === 'high' ? '🚨' : issue.severity === 'medium' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${issue.type.replace('_', ' ').toUpperCase()}`);
        console.log(`      📝 ${issue.message}`);
        console.log(`      📈 Impact: ${issue.impact}`);
        console.log('');
      });
    }

    console.log('\n📊 CATEGORY BREAKDOWN:');
    console.log(`   🚨 Overdue: ${analysis.overdueTickets.length}`);
    console.log(`   🔄 Stuck (15+ days, no progress): ${analysis.stuckTickets.length}`);
    console.log(`   ⏳ Waiting on External: ${analysis.waitingTickets.length}`);
    console.log(`   ⚡ Quick Wins: ${analysis.quickWins.length}`);

    console.log('\n✅ Intelligent analysis complete!');
    console.log(`📈 Overall Health Score: ${summary.slaCompliance}% SLA Compliance`);

  } catch (error) {
    console.error('❌ Error during intelligent analysis:', error);
  }
}

// Run the intelligent test
testIntelligentAnalysis();