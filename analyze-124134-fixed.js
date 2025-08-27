// Analyze ticket 124134 SLA - Fixed version
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const TicketSLAPolicy = require('./src/utils/ticketSLAPolicy');

// Load and parse CSV
const csvContent = fs.readFileSync('Ticket_Data_2025-08-27.csv', 'utf8');
const records = parse(csvContent, { columns: true, skip_empty_lines: true });

const slaPolicy = new TicketSLAPolicy();

// Find ticket 124134
const ticket = records.find(r => r['﻿IssueID'] === '124134' || r.IssueID === '124134');

if (!ticket) {
  console.log('Ticket 124134 not found!');
  process.exit(1);
}

console.log('\n=== Ticket #124134 Detailed Analysis ===\n');
console.log('Created:', ticket.IssueDate);
console.log('Tech Assigned:', ticket.Tech_Assigned);
console.log('\nComments (parsed line by line):');
console.log('=' .repeat(60));

// Parse comments line by line
const commentLines = ticket.comments.split('\n').map(line => line.trim()).filter(line => line);
commentLines.forEach(line => {
  console.log('  ', line);
});

console.log('\n=== Timeline Analysis ===\n');

// Parse each comment entry
const events = [];

commentLines.forEach(line => {
  // Parse date pattern at start of line
  const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*([^:]+)\s*:\s*([^:]+)\s*:\s*(.+)/);
  if (dateMatch) {
    const [_, dateStr, user, userType, message] = dateMatch;
    events.push({
      date: new Date(dateStr),
      dateStr,
      user: user.trim(),
      userType: userType.trim(),
      message: message.trim()
    });
  }
});

// Sort events by date
events.sort((a, b) => a.date - b.date);

console.log('Chronological Events:');
events.forEach(event => {
  console.log(`  ${event.dateStr} - ${event.userType}: ${event.message.substring(0, 60)}`);
});

// Find key events
const createdDate = new Date(ticket.IssueDate);
const assignmentEvent = events.find(e => 
  e.message.toLowerCase().includes('assigned to technician') || 
  e.message.toLowerCase().includes('ticket has been assigned')
);
const firstTechResponseEvent = events.find(e => 
  e.userType === 'Technician' && 
  !e.message.toLowerCase().includes('assigned to technician') &&
  !e.message.toLowerCase().includes('ticket has been assigned')
);

console.log('\n=== Key Events ===\n');
console.log('Ticket Created:', createdDate);
console.log('Assignment Event:', assignmentEvent ? assignmentEvent.dateStr : 'Not found');
console.log('First Tech Response:', firstTechResponseEvent ? firstTechResponseEvent.dateStr : 'Not found');

if (firstTechResponseEvent) {
  console.log('  Response by:', firstTechResponseEvent.user);
  console.log('  Message:', firstTechResponseEvent.message);
}

console.log('\n=== Business Hours Calculation ===\n');

if (assignmentEvent && firstTechResponseEvent) {
  const assignmentDate = assignmentEvent.date;
  const responseDate = firstTechResponseEvent.date;
  
  const businessHours = slaPolicy.getBusinessHoursBetween(assignmentDate, responseDate);
  
  console.log('Assignment Date:', assignmentDate);
  console.log('First Response Date:', responseDate);
  console.log('\nBusiness hours from assignment to first response:', businessHours.toFixed(2), 'hours');
  console.log('Business days (approx):', (businessHours / 8).toFixed(1), 'days');
  
  // Calculate calendar days for reference
  const calendarDays = (responseDate - assignmentDate) / (1000 * 60 * 60 * 24);
  console.log('Calendar days between:', calendarDays.toFixed(1), 'days');
  
  console.log('\nSLA Status:');
  console.log('  SLA Limit:', slaPolicy.slaRules.firstResponse, 'business hours');
  console.log('  Result:', businessHours <= slaPolicy.slaRules.firstResponse ? '✅ COMPLIANT' : '❌ VIOLATED');
  console.log('  Hours over SLA:', Math.max(0, businessHours - slaPolicy.slaRules.firstResponse).toFixed(2));
} else if (assignmentEvent && !firstTechResponseEvent) {
  const assignmentDate = assignmentEvent.date;
  const now = new Date();
  const businessHours = slaPolicy.getBusinessHoursBetween(assignmentDate, now);
  
  console.log('Ticket was assigned but has NO tech response yet!');
  console.log('Assignment Date:', assignmentDate);
  console.log('Business hours waiting:', businessHours.toFixed(2), 'hours');
  console.log('Business days waiting:', (businessHours / 8).toFixed(1), 'days');
  console.log('\n❌ SEVERELY VIOLATED - No response for over', Math.floor(businessHours / 8), 'business days!');
} else {
  console.log('Unable to calculate - missing assignment or response data');
}