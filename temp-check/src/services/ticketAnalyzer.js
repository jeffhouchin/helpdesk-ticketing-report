const { differenceInDays, parseISO, isValid } = require('date-fns');
const config = require('../config');

class TicketAnalyzer {
  constructor() {
    this.quickWinKeywords = config.analysis.quickWinKeywords;
    this.staleTicketDays = config.analysis.staleTicketDays;
    this.overdueTicketDays = config.analysis.overdueTicketDays;
  }

  analyzeTickets(tickets) {
    const analysis = {
      totalTickets: tickets.length,
      openTickets: [],
      staleTickets: [],
      overdueTickets: [],
      quickWins: [],
      noTechnicianResponse: [],
      highPriority: [],
      summary: {},
      recommendations: []
    };

    const now = new Date();

    tickets.forEach(ticket => {
      // Normalize ticket data (handle different possible column names)
      const normalizedTicket = this.normalizeTicket(ticket);
      
      // Skip closed tickets
      if (this.isTicketClosed(normalizedTicket)) {
        return;
      }

      analysis.openTickets.push(normalizedTicket);

      // Check for stale tickets (no recent activity)
      if (this.isStaleTicket(normalizedTicket, now)) {
        analysis.staleTickets.push(normalizedTicket);
      }

      // Check for overdue tickets
      if (this.isOverdueTicket(normalizedTicket, now)) {
        analysis.overdueTickets.push(normalizedTicket);
      }

      // Identify quick wins
      if (this.isQuickWin(normalizedTicket)) {
        analysis.quickWins.push(normalizedTicket);
      }

      // Check for tickets with no technician response
      if (this.hasNoTechnicianResponse(normalizedTicket, now)) {
        analysis.noTechnicianResponse.push(normalizedTicket);
      }

      // Identify high priority tickets
      if (this.isHighPriority(normalizedTicket)) {
        analysis.highPriority.push(normalizedTicket);
      }
    });

    // Generate summary statistics
    analysis.summary = this.generateSummary(analysis);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  normalizeTicket(ticket) {
    // Handle different possible column names for common fields
    const normalized = { ...ticket };
    
    // Common field mappings
    const fieldMappings = {
      id: ['id', 'ticket_id', 'ticketid', 'number', 'ticket_number'],
      title: ['title', 'subject', 'description', 'issue', 'summary'],
      status: ['status', 'state', 'ticket_status'],
      priority: ['priority', 'urgency', 'severity'],
      assignee: ['assignee', 'assigned_to', 'technician', 'tech'],
      requester: ['requester', 'user', 'customer', 'reporter'],
      created: ['created', 'created_date', 'date_created', 'submit_date'],
      updated: ['updated', 'last_updated', 'modified', 'last_modified'],
      due: ['due', 'due_date', 'deadline', 'target_date'],
      category: ['category', 'type', 'ticket_type']
    };

    Object.keys(fieldMappings).forEach(standardField => {
      const possibleFields = fieldMappings[standardField];
      const foundField = possibleFields.find(field => 
        Object.keys(ticket).some(key => key.toLowerCase().includes(field))
      );
      
      if (foundField) {
        const actualField = Object.keys(ticket).find(key => 
          key.toLowerCase().includes(foundField)
        );
        if (actualField && ticket[actualField] !== undefined) {
          normalized[standardField] = ticket[actualField];
        }
      }
    });

    return normalized;
  }

  isTicketClosed(ticket) {
    const status = (ticket.status || '').toString().toLowerCase();
    const closedStatuses = ['closed', 'resolved', 'completed', 'done', 'finished'];
    return closedStatuses.some(closedStatus => status.includes(closedStatus));
  }

  isStaleTicket(ticket, now) {
    const lastUpdated = this.parseDate(ticket.updated || ticket.created);
    if (!lastUpdated) return false;
    
    return differenceInDays(now, lastUpdated) >= this.staleTicketDays;
  }

  isOverdueTicket(ticket, now) {
    const dueDate = this.parseDate(ticket.due);
    if (!dueDate) return false;
    
    return now > dueDate;
  }

  isQuickWin(ticket) {
    const title = (ticket.title || '').toLowerCase();
    const category = (ticket.category || '').toLowerCase();
    
    return this.quickWinKeywords.some(keyword => 
      title.includes(keyword) || category.includes(keyword)
    );
  }

  hasNoTechnicianResponse(ticket, now) {
    const created = this.parseDate(ticket.created);
    const assignee = ticket.assignee;
    const lastUpdated = this.parseDate(ticket.updated);
    
    if (!created) return false;
    
    // If no assignee, it needs assignment
    if (!assignee || assignee.toString().trim() === '') {
      return differenceInDays(now, created) >= 1; // 1 day without assignment
    }
    
    // If assigned but no updates from creation, needs response
    if (!lastUpdated || lastUpdated <= created) {
      return differenceInDays(now, created) >= this.staleTicketDays;
    }
    
    return false;
  }

  isHighPriority(ticket) {
    const priority = (ticket.priority || '').toString().toLowerCase();
    const highPriorityValues = ['high', 'urgent', 'critical', '1', 'p1'];
    return highPriorityValues.some(value => priority.includes(value));
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    // Try different date formats
    const formats = [
      // ISO format
      () => parseISO(dateString),
      // Common formats
      () => new Date(dateString),
      // Excel serial date
      () => {
        const num = parseFloat(dateString);
        if (!isNaN(num) && num > 25000) { // Reasonable Excel date range
          return new Date((num - 25569) * 86400 * 1000);
        }
        return null;
      }
    ];

    for (const formatFn of formats) {
      try {
        const date = formatFn();
        if (date && isValid(date)) {
          return date;
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  generateSummary(analysis) {
    return {
      totalOpen: analysis.openTickets.length,
      stale: analysis.staleTickets.length,
      overdue: analysis.overdueTickets.length,
      quickWins: analysis.quickWins.length,
      noResponse: analysis.noTechnicianResponse.length,
      highPriority: analysis.highPriority.length,
      stalePercentage: analysis.openTickets.length > 0 
        ? Math.round((analysis.staleTickets.length / analysis.openTickets.length) * 100) 
        : 0
    };
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.noTechnicianResponse.length > 0) {
      recommendations.push({
        type: 'urgent',
        message: `${analysis.noTechnicianResponse.length} tickets need immediate technician attention`,
        action: 'Assign technicians and send reminders'
      });
    }

    if (analysis.quickWins.length > 0) {
      recommendations.push({
        type: 'opportunity',
        message: `${analysis.quickWins.length} quick win tickets can boost customer satisfaction`,
        action: 'Prioritize these for quick resolution'
      });
    }

    if (analysis.staleTickets.length > 0) {
      recommendations.push({
        type: 'attention',
        message: `${analysis.staleTickets.length} stale tickets may cause customer frustration`,
        action: 'Review and update these tickets'
      });
    }

    if (analysis.overdueTickets.length > 0) {
      recommendations.push({
        type: 'critical',
        message: `${analysis.overdueTickets.length} tickets are past their due date`,
        action: 'Immediate escalation required'
      });
    }

    return recommendations;
  }
}

module.exports = TicketAnalyzer;