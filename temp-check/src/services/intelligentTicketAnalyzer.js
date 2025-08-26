const { differenceInDays, format } = require('date-fns');
const BusinessDayCalculator = require('../utils/businessDays');

class IntelligentTicketAnalyzer {
  constructor() {
    this.businessDays = new BusinessDayCalculator();
    
    // Refined quick win patterns based on your criteria
    this.quickWinPatterns = {
      passwords: ['password', 'reset password', 'unlock account', 'locked out'],
      accounts: ['new user', 'new account', 'create account', 'user setup', 'onboard'],
      terminations: ['terminated', 'disable user', 'offboard', 'remove access', 'deactivate'],
      remote_fixes: ['install', 'update', 'remote', 'software', 'printer setup', 'email setup'],
      simple_requests: ['permission', 'access request', 'group add', 'distribution list']
    };
    
    // SLA definitions
    this.slaRules = {
      quickWin: { businessDays: 1, description: 'Should be resolved within 1 business day' },
      standard: { businessDays: 2, description: 'Standard helpdesk tickets' },
      complex: { businessDays: 5, description: 'Complex technical issues' },
      waiting: { businessDays: 2, description: 'Awaiting external dependency' }
    };
  }

  analyzeTickets(tickets) {
    console.log(`🧠 Running intelligent analysis on ${tickets.length} tickets...`);
    
    const now = new Date();
    const analysis = {
      totalTickets: tickets.length,
      
      // Core categories
      overdueTickets: [],
      slaViolations: [],
      quickWins: [],
      stuckTickets: [],
      needsAttention: [],
      waitingTickets: [],
      
      // Workload analysis
      technicianAnalysis: {},
      workloadDistribution: {},
      
      // Actionable insights
      immediateActions: [],
      escalationCandidates: [],
      processIssues: [],
      
      // Metrics
      slaCompliance: {},
      avgResolutionTime: {},
      
      summary: {}
    };

    tickets.forEach(ticket => {
      if (!ticket.IssueID || !ticket.IssueDate) return;

      const ticketAge = this.businessDays.getBusinessDaysSince(ticket.IssueDate);
      const isOpen = this.isTicketOpen(ticket);
      
      if (!isOpen) return; // Skip closed tickets

      // Determine ticket category and SLA
      const ticketCategory = this.categorizeTicket(ticket);
      const slaRule = this.slaRules[ticketCategory.type];
      const isOverdue = ticketAge > slaRule.businessDays;
      
      // Analyze last update
      const lastUpdate = this.getLastUpdateInfo(ticket);
      
      // Enhanced ticket object
      const enhancedTicket = {
        ...ticket,
        ticketAge,
        category: ticketCategory,
        sla: slaRule,
        isOverdue,
        lastUpdate,
        urgencyScore: this.calculateUrgencyScore(ticket, ticketAge, ticketCategory, lastUpdate),
        actionRequired: this.determineActionRequired(ticket, ticketAge, ticketCategory, lastUpdate)
      };

      // Categorize for analysis
      if (isOverdue) {
        analysis.overdueTickets.push(enhancedTicket);
      }

      if (enhancedTicket.actionRequired.severity === 'critical') {
        analysis.needsAttention.push(enhancedTicket);
      }

      if (ticketCategory.isQuickWin) {
        analysis.quickWins.push(enhancedTicket);
      }

      if (this.businessDays.isWaitingStatus(ticket.Current_Status)) {
        analysis.waitingTickets.push(enhancedTicket);
      }

      if (this.isStuckTicket(enhancedTicket)) {
        analysis.stuckTickets.push(enhancedTicket);
      }

      // Technician workload analysis
      if (ticket.Tech_Assigned_Clean) {
        this.analyzeTechnicianWorkload(analysis, enhancedTicket);
      }
    });

    // Generate insights and recommendations
    analysis.immediateActions = this.generateImmediateActions(analysis);
    analysis.escalationCandidates = this.generateEscalationCandidates(analysis);
    analysis.processIssues = this.identifyProcessIssues(analysis);
    analysis.summary = this.generateIntelligentSummary(analysis);

    console.log(`✅ Intelligent analysis complete: ${analysis.needsAttention.length} need attention, ${analysis.quickWins.length} quick wins`);
    return analysis;
  }

  categorizeTicket(ticket) {
    const subject = (ticket.Subject || '').toLowerCase();
    const body = (ticket.Ticket_Body || '').toLowerCase();
    const combined = `${subject} ${body}`;

    // Check for quick win patterns
    for (const [category, patterns] of Object.entries(this.quickWinPatterns)) {
      if (patterns.some(pattern => combined.includes(pattern))) {
        return {
          type: 'quickWin',
          subCategory: category,
          isQuickWin: true,
          reason: `Matches ${category} pattern`
        };
      }
    }

    // Check for complex indicators
    const complexIndicators = [
      'server', 'network', 'database', 'integration', 'custom', 'development',
      'migration', 'upgrade', 'security', 'compliance', 'audit'
    ];
    
    if (complexIndicators.some(indicator => combined.includes(indicator))) {
      return {
        type: 'complex',
        isQuickWin: false,
        reason: 'Complex technical issue'
      };
    }

    // Default to standard
    return {
      type: 'standard',
      isQuickWin: false,
      reason: 'Standard helpdesk ticket'
    };
  }

  getLastUpdateInfo(ticket) {
    // Try to extract last update from comments or use creation date
    const comments = ticket.comments || '';
    const created = ticket.IssueDate;
    
    // Simple heuristic: if comments exist, assume there was some update
    // In real implementation, you'd parse the comments for timestamps
    const hasComments = comments.trim().length > 0;
    const estimatedLastUpdate = hasComments ? created : null; // Simplified
    
    return this.businessDays.getLastUpdateCategory(estimatedLastUpdate, ticket.Current_Status);
  }

  calculateUrgencyScore(ticket, age, category, lastUpdate) {
    let score = 0;

    // Age factor (higher score for older tickets)
    score += Math.min(age * 10, 50);

    // SLA violation
    const slaRule = this.slaRules[category.type];
    if (age > slaRule.businessDays) {
      score += (age - slaRule.businessDays) * 15;
    }

    // Priority factor
    const priority = (ticket.Priority || '').toLowerCase();
    if (priority === 'critical') score += 40;
    else if (priority === 'high') score += 25;

    // Quick win boost (easier to resolve = higher priority for customer satisfaction)
    if (category.isQuickWin) score += 20;

    // Last update penalty
    if (lastUpdate.severity === 'critical') score += 30;
    else if (lastUpdate.severity === 'warning') score += 15;

    // Unassigned penalty
    if (!ticket.Tech_Assigned || ticket.Tech_Assigned.trim() === '') score += 25;

    return Math.min(score, 100);
  }

  determineActionRequired(ticket, age, category, lastUpdate) {
    const slaRule = this.slaRules[category.type];
    const isOverdue = age > slaRule.businessDays;
    
    if (!ticket.Tech_Assigned || ticket.Tech_Assigned.trim() === '') {
      return {
        action: 'assign_technician',
        severity: 'critical',
        message: `Unassigned ticket (${age} business days old)`
      };
    }

    if (lastUpdate.severity === 'critical' && !lastUpdate.isWaitingStatus) {
      return {
        action: 'request_update',
        severity: 'critical',
        message: `No update in ${lastUpdate.businessDays} business days`
      };
    }

    if (isOverdue && category.isQuickWin) {
      return {
        action: 'expedite_resolution',
        severity: 'warning',
        message: `Quick win ticket overdue by ${age - slaRule.businessDays} business days`
      };
    }

    if (isOverdue) {
      return {
        action: 'review_progress',
        severity: 'warning', 
        message: `SLA violation: ${age} days vs ${slaRule.businessDays} day target`
      };
    }

    if (age >= 10 && category.type === 'standard') {
      return {
        action: 'consider_escalation',
        severity: 'info',
        message: `Standard ticket open for ${age} business days - may need escalation`
      };
    }

    return {
      action: 'monitor',
      severity: 'good',
      message: 'Ticket progressing normally'
    };
  }

  isStuckTicket(ticket) {
    // Heuristics for stuck tickets
    return (
      ticket.ticketAge >= 15 && // Old ticket
      ticket.category.type !== 'waiting' && // Not waiting for external dependency
      ticket.lastUpdate.severity === 'critical' // No recent updates
    );
  }

  isTicketOpen(ticket) {
    const status = (ticket.Current_Status || '').toLowerCase();
    const closedStatuses = ['closed', 'resolved', 'completed', 'done'];
    return !closedStatuses.some(closedStatus => status.includes(closedStatus));
  }

  analyzeTechnicianWorkload(analysis, ticket) {
    const tech = ticket.Tech_Assigned_Clean;
    
    if (!analysis.technicianAnalysis[tech]) {
      analysis.technicianAnalysis[tech] = {
        totalTickets: 0,
        overdueTickets: 0,
        quickWins: 0,
        avgAge: 0,
        needsAttention: 0,
        oldestTicket: null,
        tickets: []
      };
    }

    const techData = analysis.technicianAnalysis[tech];
    techData.totalTickets++;
    techData.tickets.push(ticket);

    if (ticket.isOverdue) techData.overdueTickets++;
    if (ticket.category.isQuickWin) techData.quickWins++;
    if (ticket.actionRequired.severity === 'critical') techData.needsAttention++;

    // Track oldest ticket
    if (!techData.oldestTicket || ticket.ticketAge > techData.oldestTicket.ticketAge) {
      techData.oldestTicket = ticket;
    }

    // Calculate average age
    techData.avgAge = techData.tickets.reduce((sum, t) => sum + t.ticketAge, 0) / techData.tickets.length;
  }

  generateImmediateActions(analysis) {
    const actions = [];

    // Critical actions from needsAttention
    const criticalTickets = analysis.needsAttention.filter(t => t.actionRequired.severity === 'critical');
    if (criticalTickets.length > 0) {
      actions.push({
        priority: 'critical',
        action: 'Address Critical Tickets',
        count: criticalTickets.length,
        description: 'Tickets requiring immediate attention',
        tickets: criticalTickets.slice(0, 5)
      });
    }

    // Quick wins for easy victories
    const urgentQuickWins = analysis.quickWins
      .filter(t => t.isOverdue)
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 5);
    
    if (urgentQuickWins.length > 0) {
      actions.push({
        priority: 'high',
        action: 'Complete Overdue Quick Wins',
        count: urgentQuickWins.length,
        description: 'Easy customer satisfaction wins that are overdue',
        tickets: urgentQuickWins
      });
    }

    return actions;
  }

  generateEscalationCandidates(analysis) {
    return analysis.stuckTickets
      .filter(ticket => ticket.ticketAge >= 20) // Very old tickets
      .sort((a, b) => b.ticketAge - a.ticketAge)
      .slice(0, 10)
      .map(ticket => ({
        ...ticket,
        escalationReason: `Ticket open for ${ticket.ticketAge} business days with minimal progress`
      }));
  }

  identifyProcessIssues(analysis) {
    const issues = [];

    // Check for assignment delays
    const unassignedOld = analysis.needsAttention.filter(t => 
      t.actionRequired.action === 'assign_technician' && t.ticketAge >= 2
    );
    if (unassignedOld.length > 0) {
      issues.push({
        type: 'assignment_delay',
        severity: 'high',
        message: `${unassignedOld.length} tickets unassigned for 2+ business days`,
        impact: 'Customer satisfaction and SLA compliance'
      });
    }

    // Check for update frequency issues
    const updateIssues = analysis.needsAttention.filter(t => 
      t.actionRequired.action === 'request_update'
    );
    if (updateIssues.length > 10) {
      issues.push({
        type: 'update_frequency',
        severity: 'medium',
        message: `${updateIssues.length} tickets missing regular updates`,
        impact: 'Customer communication and transparency'
      });
    }

    return issues;
  }

  generateIntelligentSummary(analysis) {
    return {
      totalOpen: analysis.totalTickets,
      needsAttention: analysis.needsAttention.length,
      quickWins: analysis.quickWins.length,
      overdue: analysis.overdueTickets.length,
      stuck: analysis.stuckTickets.length,
      waiting: analysis.waitingTickets.length,
      
      // Key metrics
      avgTicketAge: analysis.totalTickets > 0 
        ? Math.round(analysis.overdueTickets.reduce((sum, t) => sum + t.ticketAge, 0) / Math.max(analysis.overdueTickets.length, 1))
        : 0,
      
      slaCompliance: analysis.totalTickets > 0
        ? Math.round(((analysis.totalTickets - analysis.overdueTickets.length) / analysis.totalTickets) * 100)
        : 100,

      // Action priorities
      criticalActions: analysis.immediateActions.filter(a => a.priority === 'critical').length,
      highPriorityActions: analysis.immediateActions.filter(a => a.priority === 'high').length,
      
      // Team insights  
      totalTechnicians: Object.keys(analysis.technicianAnalysis).length,
      avgTechLoad: Object.keys(analysis.technicianAnalysis).length > 0
        ? Math.round(analysis.totalTickets / Object.keys(analysis.technicianAnalysis).length)
        : 0
    };
  }
}

module.exports = IntelligentTicketAnalyzer;