const CSVParser = require('./utils/csvParser');
const BanyanTicketAnalyzer = require('./services/banyanTicketAnalyzer');
const path = require('path');

async function testAnalysis() {
  try {
    console.log('🚀 Starting ticket analysis test...\n');

    // Parse the CSV file
    const csvParser = new CSVParser();
    const csvPath = path.join(__dirname, '..', 'Ticket_Data_2025-08-22.csv');
    const tickets = await csvParser.parseTicketCSV(csvPath);

    // Analyze the tickets
    const analyzer = new BanyanTicketAnalyzer();
    const analysis = await analyzer.analyzeTickets(tickets);

    // Display results
    console.log('🎯 ANALYSIS RESULTS:');
    console.log('='.repeat(50));
    
    console.log('\n📊 SUMMARY:');
    Object.entries(analysis.summary).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });

    console.log('\n🔍 KEY INSIGHTS:');
    analysis.insights.forEach(insight => {
      const icon = insight.type === 'critical' ? '🚨' : 
                   insight.type === 'opportunity' ? '⚡' : 'ℹ️';
      console.log(`   ${icon} ${insight.title}: ${insight.message}`);
    });

    console.log('\n💡 TOP RECOMMENDATIONS:');
    analysis.recommendations.slice(0, 3).forEach((rec, index) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`);
      console.log(`      ${rec.message}`);
      console.log(`      Impact: ${rec.impact}`);
      console.log('');
    });

    console.log('\n👥 TECHNICIAN WORKLOAD:');
    Object.entries(analysis.technicianWorkload)
      .sort(([,a], [,b]) => b.open - a.open)
      .slice(0, 5)
      .forEach(([tech, workload]) => {
        console.log(`   ${tech}: ${workload.open} open tickets (${workload.assigned} total assigned)`);
      });

    console.log('\n📋 UNASSIGNED TICKETS (Top 10 by Urgency):');
    analysis.unassignedTickets
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 10)
      .forEach(ticket => {
        console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
        console.log(`     Age: ${ticket.daysSinceCreated} days | Urgency: ${ticket.urgencyScore}/100`);
        console.log(`     From: ${ticket.Submitted_By}`);
        console.log('');
      });

    console.log('\n⚡ QUICK WIN OPPORTUNITIES (Top 5):');
    analysis.quickWins.slice(0, 5).forEach(ticket => {
      console.log(`   #${ticket.IssueID} - ${ticket.Subject || 'No subject'}`);
      console.log(`     Reason: ${ticket.quickWinReason}`);
      console.log(`     Age: ${ticket.daysSinceCreated} days`);
      console.log('');
    });

    console.log('\n📈 STATUS BREAKDOWN:');
    Object.entries(analysis.statusBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([status, count]) => {
        const pct = ((count / analysis.totalTickets) * 100).toFixed(1);
        console.log(`   ${status}: ${count} (${pct}%)`);
      });

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Run the test
testAnalysis();