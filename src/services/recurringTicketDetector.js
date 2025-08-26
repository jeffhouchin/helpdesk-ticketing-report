const { differenceInDays, parseISO } = require('date-fns');

class RecurringTicketDetector {
  constructor() {
    // Patterns that indicate recurring system issues
    this.recurringPatterns = {
      cameraAlerts: {
        keywords: ['camera', 'connection', 'spectrum', 'stream', 'network issue'],
        submitterPatterns: ['dwspectrum', 'camera', 'system'],
        threshold: 0.7 // 70% keyword match
      },
      
      systemAlerts: {
        keywords: ['server', 'down', 'offline', 'error', 'failed', 'alert'],
        submitterPatterns: ['system', 'noreply', 'automated', 'monitor'],
        threshold: 0.6
      },
      
      equipmentIssues: {
        keywords: ['printer', 'offline', 'paper jam', 'toner', 'not working'],
        threshold: 0.5
      },
      
      accessIssues: {
        keywords: ['locked', 'access denied', 'login failed', 'authentication'],
        threshold: 0.6
      }
    };

    // Common recurring issue indicators
    this.recurringIndicators = [
      'recurring',
      'again', 
      'still',
      'same issue',
      'problem persists',
      'happening again',
      'multiple times',
      'repeatedly'
    ];
  }

  analyzeRecurringTickets(tickets) {
    console.log('🔄 Analyzing tickets for recurring patterns...');

    const analysis = {
      recurringTickets: [],
      recurringGroups: {},
      systemAlerts: [],
      potentialRecurring: [],
      statistics: {
        totalRecurring: 0,
        recurringByType: {},
        oldestRecurring: null,
        mostFrequentIssue: null
      }
    };

    // First pass: identify individual recurring tickets
    tickets.forEach(ticket => {
      const recurringInfo = this.identifyRecurringTicket(ticket);
      if (recurringInfo.isRecurring) {
        analysis.recurringTickets.push({
          ...ticket,
          recurringInfo
        });

        // Group by pattern type
        const groupKey = recurringInfo.patternType;
        if (!analysis.recurringGroups[groupKey]) {
          analysis.recurringGroups[groupKey] = [];
        }
        analysis.recurringGroups[groupKey].push(ticket);
      }
    });

    // Second pass: find ticket families (same subject/similar issues)
    const ticketFamilies = this.findTicketFamilies(tickets);
    Object.entries(ticketFamilies).forEach(([familyKey, familyTickets]) => {
      if (familyTickets.length > 1) {
        analysis.potentialRecurring.push({
          familyKey,
          tickets: familyTickets,
          count: familyTickets.length,
          dateRange: this.getDateRange(familyTickets),
          pattern: this.analyzeFamilyPattern(familyTickets)
        });
      }
    });

    // Generate statistics
    analysis.statistics = this.generateRecurringStatistics(analysis);

    console.log(`🔄 Found ${analysis.recurringTickets.length} recurring tickets in ${Object.keys(analysis.recurringGroups).length} categories`);
    return analysis;
  }

  identifyRecurringTicket(ticket) {
    const subject = (ticket.Subject || '').toLowerCase();
    const body = (ticket.Ticket_Body || '').toLowerCase();
    const submitter = (ticket.Submitted_By || '').toLowerCase();
    const combined = `${subject} ${body}`;

    // Check for explicit recurring language
    const hasRecurringLanguage = this.recurringIndicators.some(indicator => 
      combined.includes(indicator)
    );

    // Check against pattern categories
    let bestMatch = { score: 0, type: null, reasons: [] };

    Object.entries(this.recurringPatterns).forEach(([patternType, pattern]) => {
      const keywordMatches = pattern.keywords.filter(keyword => 
        combined.includes(keyword)
      );
      const keywordScore = keywordMatches.length / pattern.keywords.length;

      const submitterMatches = pattern.submitterPatterns ? 
        pattern.submitterPatterns.some(submitterPattern => 
          submitter.includes(submitterPattern)
        ) : false;

      let totalScore = keywordScore;
      if (submitterMatches) totalScore += 0.3; // Bonus for system submitter
      if (hasRecurringLanguage) totalScore += 0.2; // Bonus for recurring language

      if (totalScore > bestMatch.score && totalScore >= pattern.threshold) {
        bestMatch = {
          score: totalScore,
          type: patternType,
          reasons: [
            ...keywordMatches.map(k => `Contains "${k}"`),
            ...(submitterMatches ? ['System/automated submitter'] : []),
            ...(hasRecurringLanguage ? ['Contains recurring language'] : [])
          ]
        };
      }
    });

    // Special cases for very old tickets (likely recurring if still active)
    const ticketAge = differenceInDays(new Date(), ticket.IssueDate);
    const isVeryOld = ticketAge > 30;
    const isSystemGenerated = this.isSystemGenerated(ticket);

    if (isVeryOld && isSystemGenerated && bestMatch.score === 0) {
      bestMatch = {
        score: 0.5,
        type: 'oldSystemTicket',
        reasons: ['Very old system-generated ticket likely recurring']
      };
    }

    return {
      isRecurring: bestMatch.score > 0,
      patternType: bestMatch.type,
      confidence: Math.min(bestMatch.score, 1.0),
      reasons: bestMatch.reasons,
      hasRecurringLanguage,
      isSystemGenerated,
      age: ticketAge
    };
  }

  findTicketFamilies(tickets) {
    const families = {};

    tickets.forEach(ticket => {
      // Create family keys based on similar subjects and submitters
      const familyKeys = this.generateFamilyKeys(ticket);
      
      familyKeys.forEach(familyKey => {
        if (!families[familyKey]) {
          families[familyKey] = [];
        }
        families[familyKey].push(ticket);
      });
    });

    // Filter out single-ticket families
    Object.keys(families).forEach(key => {
      if (families[key].length === 1) {
        delete families[key];
      }
    });

    return families;
  }

  generateFamilyKeys(ticket) {
    const subject = (ticket.Subject || '').toLowerCase();
    const submitter = (ticket.Submitted_By || '').toLowerCase();
    const keys = [];

    // Key 1: Submitter + core subject words
    const coreWords = this.extractCoreWords(subject);
    if (coreWords.length > 0) {
      keys.push(`${submitter}:${coreWords.join('_')}`);
    }

    // Key 2: System-generated pattern matching
    if (this.isSystemGenerated(ticket)) {
      const systemPattern = this.extractSystemPattern(subject, ticket.Ticket_Body);
      if (systemPattern) {
        keys.push(`system:${systemPattern}`);
      }
    }

    return keys;
  }

  extractCoreWords(subject) {
    // Remove common words and extract meaningful terms
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = subject.split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !commonWords.includes(word))
      .slice(0, 3); // Take first 3 meaningful words
    
    return words;
  }

  extractSystemPattern(subject, body) {
    const combined = `${subject} ${body}`.toLowerCase();
    
    // Common system patterns
    if (combined.includes('camera') && combined.includes('connection')) return 'camera_connection';
    if (combined.includes('server') && combined.includes('down')) return 'server_down';
    if (combined.includes('network') && combined.includes('issue')) return 'network_issue';
    if (combined.includes('printer') && combined.includes('offline')) return 'printer_offline';
    
    return null;
  }

  analyzeFamilyPattern(familyTickets) {
    const dates = familyTickets.map(t => t.IssueDate).filter(d => d).sort();
    if (dates.length < 2) return { type: 'insufficient_data' };

    // Calculate time intervals between tickets
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(differenceInDays(dates[i], dates[i-1]));
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    let patternType;
    if (avgInterval < 7) patternType = 'frequent_recurring';
    else if (avgInterval < 30) patternType = 'regular_recurring';
    else patternType = 'periodic_recurring';

    return {
      type: patternType,
      avgInterval: Math.round(avgInterval),
      frequency: `Every ${Math.round(avgInterval)} days`,
      totalOccurrences: familyTickets.length,
      dateRange: {
        first: dates[0],
        last: dates[dates.length - 1]
      }
    };
  }

  isSystemGenerated(ticket) {
    const submitter = (ticket.Submitted_By || '').toLowerCase();
    const systemIndicators = ['dwspectrum', 'system@', 'noreply@', 'automated@', 'monitor@'];
    return systemIndicators.some(indicator => submitter.includes(indicator));
  }

  getDateRange(tickets) {
    const dates = tickets.map(t => t.IssueDate).filter(d => d).sort();
    return {
      earliest: dates[0],
      latest: dates[dates.length - 1],
      span: dates.length > 1 ? differenceInDays(dates[dates.length - 1], dates[0]) : 0
    };
  }

  generateRecurringStatistics(analysis) {
    const stats = {
      totalRecurring: analysis.recurringTickets.length,
      recurringByType: {},
      oldestRecurring: null,
      mostFrequentIssue: null
    };

    // Count by type
    analysis.recurringTickets.forEach(ticket => {
      const type = ticket.recurringInfo.patternType;
      stats.recurringByType[type] = (stats.recurringByType[type] || 0) + 1;
    });

    // Find oldest recurring ticket
    if (analysis.recurringTickets.length > 0) {
      stats.oldestRecurring = analysis.recurringTickets.reduce((oldest, ticket) => 
        !oldest || ticket.recurringInfo.age > oldest.recurringInfo.age ? ticket : oldest
      );
    }

    // Find most frequent issue
    const typeEntries = Object.entries(stats.recurringByType);
    if (typeEntries.length > 0) {
      const [mostFrequentType, count] = typeEntries.reduce(([maxType, maxCount], [type, typeCount]) =>
        typeCount > maxCount ? [type, typeCount] : [maxType, maxCount]
      );
      stats.mostFrequentIssue = { type: mostFrequentType, count };
    }

    return stats;
  }
}

module.exports = RecurringTicketDetector;