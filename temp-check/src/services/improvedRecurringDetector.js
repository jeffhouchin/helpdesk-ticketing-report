const { differenceInDays, differenceInYears } = require('date-fns');

class ImprovedRecurringDetector {
  constructor() {
    // Indicators that a ticket is likely recurring (reused ticket ID)
    this.recurringIndicators = {
      // Age-based indicators
      ancientTicket: {
        minAge: 365, // Tickets over 1 year old still active are likely recurring
        description: 'Very old ticket still active'
      },
      
      // Date inconsistencies that suggest reopening
      dateInconsistencies: {
        description: 'Due dates or update dates much newer than creation'
      },
      
      // Comments suggesting recurring nature
      recurringLanguage: [
        'recurring', 'again', 'still happening', 'reoccurring', 'same issue',
        'happening again', 'back to', 'returned', 'reopened', 'still seeing'
      ],
      
      // Patterns in comments that suggest multiple incidents
      multipleIncidents: [
        'due date has been changed', 'reassigned', 'updated status',
        'priority changed', 'extended', 'rescheduled'
      ]
    };
  }

  analyzeRecurringTickets(tickets) {
    console.log('🔄 Analyzing tickets for ACTUAL recurring patterns...');

    const analysis = {
      trueRecurringTickets: [],
      suspiciousTickets: [],
      ancientTickets: [],
      dateInconsistencies: [],
      statistics: {
        totalRecurring: 0,
        oldestTicket: null,
        averageRecurringAge: 0,
        recurringByAge: {
          over5Years: 0,
          over2Years: 0,
          over1Year: 0
        }
      }
    };

    tickets.forEach(ticket => {
      const recurringAnalysis = this.analyzeTicketForRecurring(ticket);
      
      if (recurringAnalysis.isRecurring) {
        analysis.trueRecurringTickets.push({
          ...ticket,
          recurringAnalysis
        });
      } else if (recurringAnalysis.suspicious) {
        analysis.suspiciousTickets.push({
          ...ticket,
          recurringAnalysis
        });
      }

      // Categorize by age
      if (recurringAnalysis.age > 365) {
        analysis.ancientTickets.push({
          ...ticket,
          recurringAnalysis
        });
      }

      // Check for date inconsistencies
      const dateIssues = this.checkDateConsistency(ticket);
      if (dateIssues.hasInconsistencies) {
        analysis.dateInconsistencies.push({
          ...ticket,
          dateIssues
        });
      }
    });

    // Generate statistics
    analysis.statistics = this.generateStatistics(analysis);

    console.log(`🔄 Found ${analysis.trueRecurringTickets.length} likely recurring tickets, ${analysis.suspiciousTickets.length} suspicious`);
    return analysis;
  }

  analyzeTicketForRecurring(ticket) {
    const issueDate = ticket.IssueDate;
    const dueDate = ticket.DueDate;
    const comments = ticket.comments || '';
    const age = issueDate ? differenceInDays(new Date(), issueDate) : 0;
    const ageInYears = issueDate ? differenceInYears(new Date(), issueDate) : 0;

    let isRecurring = false;
    let suspicious = false;
    const reasons = [];
    let confidence = 0;

    // Check 1: Ancient tickets (over 1 year old and still active)
    if (age >= this.recurringIndicators.ancientTicket.minAge) {
      if (ageInYears >= 5) {
        isRecurring = true;
        confidence += 0.9;
        reasons.push(`Ticket is ${ageInYears} years old - almost certainly recurring`);
      } else if (ageInYears >= 2) {
        isRecurring = true;
        confidence += 0.7;
        reasons.push(`Ticket is ${ageInYears} years old - likely recurring`);
      } else {
        suspicious = true;
        confidence += 0.5;
        reasons.push(`Ticket is ${Math.round(age/365*10)/10} years old - possibly recurring`);
      }
    }

    // Check 2: Due date much newer than creation date
    if (issueDate && dueDate) {
      const daysBetween = differenceInDays(dueDate, issueDate);
      if (daysBetween > 365) {
        isRecurring = true;
        confidence += 0.8;
        reasons.push(`Due date is ${Math.round(daysBetween/365*10)/10} years after creation - indicates reopening`);
      } else if (daysBetween > 180) {
        suspicious = true;
        confidence += 0.4;
        reasons.push(`Due date is ${daysBetween} days after creation - unusual gap`);
      }
    }

    // Check 3: Comments indicating recurring nature
    const lowerComments = comments.toLowerCase();
    let recurringLanguageFound = 0;
    let multipleIncidentsFound = 0;

    this.recurringIndicators.recurringLanguage.forEach(phrase => {
      if (lowerComments.includes(phrase)) {
        recurringLanguageFound++;
        reasons.push(`Comments contain recurring language: "${phrase}"`);
      }
    });

    this.recurringIndicators.multipleIncidents.forEach(phrase => {
      if (lowerComments.includes(phrase)) {
        multipleIncidentsFound++;
        reasons.push(`Comments suggest multiple incidents: "${phrase}"`);
      }
    });

    if (recurringLanguageFound > 0) {
      confidence += 0.6;
      if (recurringLanguageFound >= 2) isRecurring = true;
      else suspicious = true;
    }

    if (multipleIncidentsFound > 0) {
      confidence += 0.4;
      suspicious = true;
    }

    // Check 4: Status/priority changes over time (heuristic)
    if (lowerComments.includes('priority') || lowerComments.includes('status') || 
        lowerComments.includes('assigned') || lowerComments.includes('due date')) {
      confidence += 0.2;
      reasons.push('Comments indicate ticket has been actively managed over time');
    }

    return {
      isRecurring: isRecurring || confidence >= 0.7,
      suspicious: suspicious || (confidence >= 0.3 && confidence < 0.7),
      confidence: Math.min(confidence, 1.0),
      reasons,
      age,
      ageInYears: Math.round(ageInYears * 10) / 10,
      recurringType: this.determineRecurringType(ticket, age, reasons)
    };
  }

  determineRecurringType(ticket, age, reasons) {
    const subject = (ticket.Subject || '').toLowerCase();
    const comments = (ticket.comments || '').toLowerCase();

    // Type classification based on content and age
    if (age > 1825) return 'ancient_zombie'; // 5+ years
    if (age > 730) return 'old_recurring'; // 2+ years
    if (age > 365) return 'yearly_recurring'; // 1+ years

    // Content-based classification
    if (subject.includes('security') || subject.includes('audit')) return 'security_recurring';
    if (subject.includes('maintenance') || subject.includes('scheduled')) return 'maintenance_recurring';
    if (subject.includes('monitor') || subject.includes('alert')) return 'monitoring_recurring';
    if (comments.includes('due date has been changed')) return 'extended_task';

    return 'unknown_recurring';
  }

  checkDateConsistency(ticket) {
    const issueDate = ticket.IssueDate;
    const dueDate = ticket.DueDate;
    const startDate = ticket.StartDate;
    
    const issues = [];
    let hasInconsistencies = false;

    if (issueDate && dueDate) {
      const daysDiff = differenceInDays(dueDate, issueDate);
      if (daysDiff > 1000) { // Due date more than ~3 years after creation
        issues.push(`Due date is ${Math.round(daysDiff/365*10)/10} years after creation`);
        hasInconsistencies = true;
      }
    }

    if (issueDate && startDate) {
      const daysDiff = differenceInDays(startDate, issueDate);
      if (Math.abs(daysDiff) > 365) { // Start date very different from issue date
        issues.push(`Start date is ${daysDiff} days ${daysDiff > 0 ? 'after' : 'before'} creation`);
        hasInconsistencies = true;
      }
    }

    return {
      hasInconsistencies,
      issues
    };
  }

  generateStatistics(analysis) {
    const stats = {
      totalRecurring: analysis.trueRecurringTickets.length,
      totalSuspicious: analysis.suspiciousTickets.length,
      totalAncient: analysis.ancientTickets.length,
      oldestTicket: null,
      averageRecurringAge: 0,
      recurringByAge: {
        over5Years: 0,
        over2Years: 0,
        over1Year: 0
      },
      recurringByType: {}
    };

    // Find oldest ticket
    const allTickets = [...analysis.trueRecurringTickets, ...analysis.suspiciousTickets];
    if (allTickets.length > 0) {
      stats.oldestTicket = allTickets.reduce((oldest, ticket) =>
        !oldest || ticket.recurringAnalysis.age > oldest.recurringAnalysis.age ? ticket : oldest
      );
    }

    // Calculate average age of recurring tickets
    if (analysis.trueRecurringTickets.length > 0) {
      const totalAge = analysis.trueRecurringTickets.reduce((sum, ticket) => 
        sum + ticket.recurringAnalysis.age, 0
      );
      stats.averageRecurringAge = Math.round(totalAge / analysis.trueRecurringTickets.length);
    }

    // Categorize by age
    analysis.trueRecurringTickets.forEach(ticket => {
      const age = ticket.recurringAnalysis.age;
      if (age >= 1825) stats.recurringByAge.over5Years++;
      else if (age >= 730) stats.recurringByAge.over2Years++;
      else if (age >= 365) stats.recurringByAge.over1Year++;

      // Count by type
      const type = ticket.recurringAnalysis.recurringType;
      stats.recurringByType[type] = (stats.recurringByType[type] || 0) + 1;
    });

    return stats;
  }
}

module.exports = ImprovedRecurringDetector;