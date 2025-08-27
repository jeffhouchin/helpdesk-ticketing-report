// Debug SLA calculations for multiple tickets
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const TicketSLAPolicy = require('./src/utils/ticketSLAPolicy');
const DataProcessor = require('./src/modules/dataProcessor');

// Load and parse CSV
const csvContent = fs.readFileSync('Ticket_Data_2025-08-27.csv', 'utf8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

const slaPolicy = new TicketSLAPolicy();
const dataProcessor = new DataProcessor();

// Process tickets to add clean tech names
const processedTickets = records.map(ticket => {
  if (ticket.Tech_Assigned) {
    const techInfo = dataProcessor.cleanTechnicianName(ticket.Tech_Assigned);
    ticket.Tech_Assigned_Clean = techInfo.clean;
    ticket.Tech_Username = techInfo.username;
    ticket.Tech_Email = techInfo.email;
  }
  return ticket;
});

// Filter open tickets
const openTickets = processedTickets.filter(ticket => 
  ticket.Current_Status !== 'Resolved' && 
  ticket.Current_Status !== 'Closed'
);

console.log(`\n=== SLA Analysis Debug ===`);
console.log(`Total open tickets: ${openTickets.length}\n`);

// Analyze a sample of tickets
const sampleSize = 10;
const violations = [];

console.log('Analyzing sample tickets for SLA violations:\n');

openTickets.slice(0, sampleSize).forEach(ticket => {
  console.log(`\nTicket #${ticket['﻿IssueID'] || ticket.IssueID}:`);
  console.log(`  Created: ${ticket.IssueDate}`);
  console.log(`  Tech: ${ticket.Tech_Assigned || 'UNASSIGNED'}`);
  console.log(`  Status: ${ticket.Current_Status}`);
  console.log(`  Subject: ${(ticket.Subject || '').substring(0, 50)}`);
  
  // Analyze SLA
  const slaAnalysis = slaPolicy.analyzeSLA(ticket);
  
  console.log(`\n  Assignment SLA:`);
  console.log(`    Status: ${slaAnalysis.assignment.status}`);
  console.log(`    Hours Elapsed: ${slaAnalysis.assignment.hoursElapsed?.toFixed(2) || 'N/A'}`);
  console.log(`    SLA Limit: ${slaAnalysis.assignment.slaLimit} hours`);
  console.log(`    Message: ${slaAnalysis.assignment.message}`);
  
  if (slaAnalysis.assignment.status === 'VIOLATED') {
    violations.push({
      ticketId: ticket['﻿IssueID'] || ticket.IssueID,
      type: 'Assignment',
      hoursOverdue: slaAnalysis.assignment.hoursOverdue?.toFixed(2),
      message: slaAnalysis.assignment.message
    });
  }
  
  console.log(`\n  First Response SLA:`);
  console.log(`    Status: ${slaAnalysis.firstResponse.status}`);
  console.log(`    Hours Elapsed: ${slaAnalysis.firstResponse.hoursElapsed?.toFixed(2) || 'N/A'}`);
  console.log(`    SLA Limit: ${slaAnalysis.firstResponse.slaLimit} hours`);
  console.log(`    Message: ${slaAnalysis.firstResponse.message}`);
  
  if (slaAnalysis.firstResponse.status === 'VIOLATED') {
    violations.push({
      ticketId: ticket['﻿IssueID'] || ticket.IssueID,
      type: 'First Response',
      hoursOverdue: slaAnalysis.firstResponse.hoursOverdue?.toFixed(2),
      message: slaAnalysis.firstResponse.message
    });
  }
  
  console.log('  ' + '='.repeat(50));
});

console.log(`\n\n=== VIOLATIONS SUMMARY ===`);
console.log(`Found ${violations.length} violations in sample of ${sampleSize} tickets\n`);

violations.forEach(v => {
  console.log(`Ticket #${v.ticketId}: ${v.type} - ${v.hoursOverdue} hours overdue`);
  console.log(`  ${v.message}\n`);
});

// Check all tickets for violations
console.log('\n=== FULL SCAN ===');
let totalAssignmentViolations = 0;
let totalResponseViolations = 0;

openTickets.forEach(ticket => {
  const slaAnalysis = slaPolicy.analyzeSLA(ticket);
  if (slaAnalysis.assignment.status === 'VIOLATED') totalAssignmentViolations++;
  if (slaAnalysis.firstResponse.status === 'VIOLATED') totalResponseViolations++;
});

console.log(`Total Assignment Violations: ${totalAssignmentViolations}`);
console.log(`Total First Response Violations: ${totalResponseViolations}`);

// Check business hours calculation for very old tickets
console.log('\n=== Business Hours Check for Old Tickets ===');
const oldTickets = openTickets.filter(t => {
  const age = (new Date() - new Date(t.IssueDate)) / (1000 * 60 * 60 * 24);
  return age > 30;
});

console.log(`\nTickets older than 30 days: ${oldTickets.length}`);

if (oldTickets.length > 0) {
  const sampleOld = oldTickets[0];
  console.log(`\nSample old ticket #${sampleOld['﻿IssueID'] || sampleOld.IssueID}:`);
  console.log(`  Created: ${sampleOld.IssueDate}`);
  
  const createdDate = new Date(sampleOld.IssueDate);
  const now = new Date();
  const businessHours = slaPolicy.getBusinessHoursBetween(createdDate, now);
  
  console.log(`  Business hours elapsed: ${businessHours.toFixed(2)}`);
  console.log(`  Business days (approx): ${(businessHours / 8).toFixed(1)}`);
  console.log(`  Calendar days: ${((now - createdDate) / (1000 * 60 * 60 * 24)).toFixed(1)}`);
}