// Analyze ticket 124134 SLA
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const TicketSLAPolicy = require('./src/utils/ticketSLAPolicy');
const DataProcessor = require('./src/modules/dataProcessor');

// Load and parse CSV
const csvContent = fs.readFileSync('Ticket_Data_2025-08-27.csv', 'utf8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

const slaPolicy = new TicketSLAPolicy();
const dataProcessor = new DataProcessor();

// Find ticket 124134
const ticket = records.find(r => r['﻿IssueID'] === '124134' || r.IssueID === '124134');

if (!ticket) {
  console.log('Ticket 124134 not found!');
  process.exit(1);
}

console.log('\n=== Ticket #124134 Analysis ===\n');
console.log('IssueID:', ticket['﻿IssueID'] || ticket.IssueID);
console.log('Created:', ticket.IssueDate);
console.log('Submitted By:', ticket.Submitted_By);
console.log('Tech Assigned:', ticket.Tech_Assigned);
console.log('Subject:', ticket.Subject);
console.log('Status:', ticket.Current_Status);
console.log('Priority:', ticket.Priority);
console.log('\nTicket Body (first 200 chars):', (ticket.Ticket_Body || '').substring(0, 200));
console.log('\nComments:');
console.log(ticket.comments);

// Parse comments to find assignment and response times
console.log('\n=== Analyzing Comments for Dates ===\n');

// Look for assignment
const assignmentPattern = /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:.*?(?:ticket has been assigned to|assigned to technician|assigned:|reassigned to)/i;
const assignmentMatch = ticket.comments?.match(assignmentPattern);

if (assignmentMatch) {
  console.log('Assignment found in comments:', assignmentMatch[1]);
  const assignmentDate = new Date(assignmentMatch[1]);
  console.log('Assignment Date parsed:', assignmentDate);
} else {
  console.log('No assignment found in comments - will estimate based on tech being assigned');
}

// Look for tech responses
const techResponsePattern = /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*(?:BHOPB\\[^:]+|bhopb\\[^:]+)\s*:\s*Technician/gi;
let firstTechResponse = null;
let match;

while ((match = techResponsePattern.exec(ticket.comments)) !== null) {
  const responseDate = new Date(match[1]);
  console.log('\nTech response found at:', match[1]);
  console.log('Full match context:', match[0].substring(0, 100));
  
  // Check if this is just an assignment message
  const contextAfterDate = ticket.comments.substring(match.index, match.index + 200);
  if (contextAfterDate.includes('ticket has been assigned') || 
      contextAfterDate.includes('assigned to technician')) {
    console.log('  -> This is an assignment message, not a response');
    continue;
  }
  
  if (!firstTechResponse || responseDate < firstTechResponse) {
    firstTechResponse = responseDate;
    console.log('  -> This is the first tech response');
  }
}

console.log('\n=== SLA Analysis ===\n');

// Get full SLA analysis
const slaAnalysis = slaPolicy.analyzeSLA(ticket);

console.log('Assignment SLA:');
console.log('  Status:', slaAnalysis.assignment.status);
console.log('  Hours Elapsed:', slaAnalysis.assignment.hoursElapsed?.toFixed(2) || 'N/A');
console.log('  SLA Limit:', slaAnalysis.assignment.slaLimit);
console.log('  Message:', slaAnalysis.assignment.message);

console.log('\nFirst Response SLA:');
console.log('  Status:', slaAnalysis.firstResponse.status);
console.log('  Hours Elapsed:', slaAnalysis.firstResponse.hoursElapsed?.toFixed(2) || 'N/A');
console.log('  SLA Limit:', slaAnalysis.firstResponse.slaLimit);
console.log('  Message:', slaAnalysis.firstResponse.message);

// Manual calculation to verify
console.log('\n=== Manual Business Hours Calculation ===\n');

const createdDate = new Date(ticket.IssueDate);
console.log('Ticket Created:', createdDate);

// Estimate assignment date
const estimatedAssignment = slaPolicy.estimateAssignmentDate(ticket);
console.log('Estimated Assignment:', estimatedAssignment);

// Get first response date
const firstResponseDate = slaPolicy.getFirstTechResponseDate(ticket);
console.log('First Tech Response:', firstResponseDate);

if (estimatedAssignment && firstResponseDate) {
  const businessHours = slaPolicy.getBusinessHoursBetween(estimatedAssignment, firstResponseDate);
  console.log('\nBusiness hours from assignment to first response:', businessHours.toFixed(2));
  console.log('SLA Limit for first response:', slaPolicy.slaRules.firstResponse, 'hours');
  console.log('Status:', businessHours <= slaPolicy.slaRules.firstResponse ? 'COMPLIANT' : 'VIOLATED');
} else if (estimatedAssignment && !firstResponseDate) {
  const now = new Date();
  const businessHoursSinceAssignment = slaPolicy.getBusinessHoursBetween(estimatedAssignment, now);
  console.log('\nNo tech response found.');
  console.log('Business hours since assignment:', businessHoursSinceAssignment.toFixed(2));
  console.log('This ticket has been waiting for', (businessHoursSinceAssignment / 8).toFixed(1), 'business days');
}