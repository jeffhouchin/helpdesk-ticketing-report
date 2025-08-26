const { differenceInDays, format, isAfter, isBefore } = require('date-fns');
const config = require('../config');

class BanyanTicketAnalyzer {
  constructor() {
    this.quickWinKeywords = [
      'password', 'unlock', 'reset', 'printer', 'email', 'login',
      'access', 'portal', 'account', 'prescription portal'
    ];
    this.staleTicketDays = 3;
    this.overdueTicketDays = 5;
    this.systemTicketEmails = [
      'dwspectrumgbrbsh@banyancenters.com',
      'dwspectrum', // partial match for camera systems
      'system@', 'noreply@', 'automated@'
    ];
  }

  analyzeTickets(tickets) {
    console.log(`🔍 Analyzing ${tickets.length} tickets...`);
    
    const now = new Date();
    const analysis = {
      totalTickets: tickets.length,
      openTickets: [],
      unassignedTickets: [],
      staleTickets: [],
      systemGeneratedTickets: [],
      userTickets: [],
      quickWins: [],
      oldTickets: [],
      recentActivity: [],
      statusBreakdown: {},
      technicianWorkload: {},
      submitterAnalysis: {},
      recommendations: []
    };

    tickets.forEach(ticket => {
      // Skip if missing essential data
      if (!ticket.IssueID || !ticket.IssueDate) {
        return;
      }

      const daysSinceCreated = differenceInDays(now, ticket.IssueDate);
      const isOpen = this.isTicketOpen(ticket);
      
      if (isOpen) {
        analysis.openTickets.push(ticket);
      }

      // Categorize tickets
      if (this.isSystemGenerated(ticket)) {
        analysis.systemGeneratedTickets.push(ticket);
      } else {
        analysis.userTickets.push(ticket);
      }

      // Check assignment status
      if (isOpen && !this.hasTechAssigned(ticket)) {
        analysis.unassignedTickets.push({
          ...ticket,
          daysSinceCreated,
          urgencyScore: this.calculateUrgencyScore(ticket, daysSinceCreated)
        });
      }

      // Check for stale tickets (open tickets with no recent activity)
      if (isOpen && daysSinceCreated >= this.staleTicketDays) {
        analysis.staleTickets.push({
          ...ticket,
          daysSinceCreated,
          staleness: this.calculateStalenessLevel(daysSinceCreated)
        });
      }

      // Identify quick wins
      if (isOpen && this.isQuickWin(ticket)) {
        analysis.quickWins.push({
          ...ticket,
          daysSinceCreated,
          quickWinReason: this.getQuickWinReason(ticket)
        });
      }

      // Track old tickets (open for a long time)
      if (isOpen && daysSinceCreated >= 14) {
        analysis.oldTickets.push({
          ...ticket,
          daysSinceCreated
        });
      }

      // Recent activity (last 24 hours)
      if (daysSinceCreated <= 1) {
        analysis.recentActivity.push(ticket);
      }

      // Status breakdown
      const status = ticket.Current_Status || 'Unknown';
      analysis.statusBreakdown[status] = (analysis.statusBreakdown[status] || 0) + 1;

      // Technician workload
      if (ticket.Tech_Assigned_Clean) {
        const tech = ticket.Tech_Assigned_Clean;
        if (!analysis.technicianWorkload[tech]) {
          analysis.technicianWorkload[tech] = {
            assigned: 0,
            open: 0,
            oldestTicket: null
          };
        }
        analysis.technicianWorkload[tech].assigned++;
        if (isOpen) {
          analysis.technicianWorkload[tech].open++;
          if (!analysis.technicianWorkload[tech].oldestTicket || 
              ticket.IssueDate < analysis.technicianWorkload[tech].oldestTicket.IssueDate) {
            analysis.technicianWorkload[tech].oldestTicket = ticket;
          }
        }
      }

      // Submitter analysis
      const submitter = ticket.Submitted_By || 'Unknown';
      if (!analysis.submitterAnalysis[submitter]) {
        analysis.submitterAnalysis[submitter] = {
          total: 0,
          open: 0,
          isSystem: this.isSystemGenerated(ticket)
        };
      }
      analysis.submitterAnalysis[submitter].total++;
      if (isOpen) {
        analysis.submitterAnalysis[submitter].open++;
      }
    });

    // Generate insights and recommendations
    analysis.insights = this.generateInsights(analysis);
    analysis.recommendations = this.generateRecommendations(analysis);
    analysis.summary = this.generateSummary(analysis);

    console.log(`✅ Analysis complete: ${analysis.openTickets.length} open, ${analysis.unassignedTickets.length} unassigned`);
    return analysis;
  }

  isTicketOpen(ticket) {
    const status = (ticket.Current_Status || '').toLowerCase();
    const closedStatuses = ['closed', 'resolved', 'completed', 'done'];
    return !closedStatuses.some(closedStatus => status.includes(closedStatus));
  }

  isSystemGenerated(ticket) {
    const submitter = (ticket.Submitted_By || '').toLowerCase();
    return this.systemTicketEmails.some(systemEmail => 
      submitter.includes(systemEmail.toLowerCase())
    );
  }

  hasTechAssigned(ticket) {
    return ticket.Tech_Assigned && ticket.Tech_Assigned.trim() !== '';
  }

  isQuickWin(ticket) {
    const subject = (ticket.Subject || '').toLowerCase();
    const body = (ticket.Ticket_Body || '').toLowerCase();
    
    return this.quickWinKeywords.some(keyword => 
      subject.includes(keyword) || body.includes(keyword)
    );
  }

  getQuickWinReason(ticket) {
    const subject = (ticket.Subject || '').toLowerCase();
    const body = (ticket.Ticket_Body || '').toLowerCase();
    
    const matchedKeyword = this.quickWinKeywords.find(keyword => 
      subject.includes(keyword) || body.includes(keyword)
    );
    
    return matchedKeyword ? `Contains "${matchedKeyword}"` : 'Quick resolution possible';
  }

  calculateUrgencyScore(ticket, daysSinceCreated) {
    let score = 0;
    
    // Age factor
    score += Math.min(daysSinceCreated * 10, 50);
    
    // Priority factor
    const priority = (ticket.Priority || '').toLowerCase();
    if (priority.includes('high') || priority.includes('urgent')) {
      score += 30;
    }
    
    // Quick win bonus
    if (this.isQuickWin(ticket)) {
      score += 20;
    }
    
    // User vs system ticket
    if (!this.isSystemGenerated(ticket)) {
      score += 10; // User tickets more urgent than system alerts
    }
    
    return Math.min(score, 100);
  }

  calculateStalenessLevel(daysSinceCreated) {
    if (daysSinceCreated >= 14) return 'Very Stale';
    if (daysSinceCreated >= 7) return 'Stale';
    if (daysSinceCreated >= 3) return 'Getting Stale';
    return 'Fresh';
  }

  generateInsights(analysis) {
    const insights = [];

    // Unassigned ticket insight
    if (analysis.unassignedTickets.length > 0) {
      const avgDays = analysis.unassignedTickets.reduce((sum, t) => sum + t.daysSinceCreated, 0) / analysis.unassignedTickets.length;
      insights.push({
        type: 'critical',
        title: 'Unassigned Tickets Need Attention',
        message: `${analysis.unassignedTickets.length} tickets are unassigned, averaging ${avgDays.toFixed(1)} days old`,
        count: analysis.unassignedTickets.length
      });
    }

    // System vs user ticket ratio
    const systemPct = ((analysis.systemGeneratedTickets.length / analysis.totalTickets) * 100).toFixed(1);
    insights.push({
      type: 'info',
      title: 'System-Generated Tickets',
      message: `${systemPct}% of tickets are system-generated (camera alerts, etc.)`,
      count: analysis.systemGeneratedTickets.length
    });

    // Quick wins opportunity
    if (analysis.quickWins.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Quick Win Opportunities',
        message: `${analysis.quickWins.length} tickets could be resolved quickly for customer satisfaction boost`,
        count: analysis.quickWins.length
      });
    }

    // Technician workload
    const techCount = Object.keys(analysis.technicianWorkload).length;
    if (techCount > 0) {
      const totalAssigned = Object.values(analysis.technicianWorkload).reduce((sum, tech) => sum + tech.open, 0);
      const avgWorkload = (totalAssigned / techCount).toFixed(1);
      insights.push({
        type: 'info',
        title: 'Technician Workload',
        message: `${techCount} technicians have work, averaging ${avgWorkload} open tickets each`,
        count: totalAssigned
      });
    }

    return insights;
  }

  generateRecommendations(analysis) {
    const recommendations = [];

    // High-priority recommendations
    if (analysis.unassignedTickets.length > 0) {
      // Sort by urgency score
      const urgentUnassigned = analysis.unassignedTickets
        .filter(t => t.urgencyScore >= 50)
        .sort((a, b) => b.urgencyScore - a.urgencyScore);

      if (urgentUnassigned.length > 0) {
        recommendations.push({
          priority: 'high',
          action: 'Assign Urgent Tickets',
          message: `${urgentUnassigned.length} unassigned tickets need immediate attention`,
          tickets: urgentUnassigned.slice(0, 5), // Top 5
          impact: 'Customer satisfaction and SLA compliance'
        });
      }
    }

    // Quick wins recommendation
    if (analysis.quickWins.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Process Quick Wins',
        message: `${analysis.quickWins.length} tickets can be resolved quickly`,
        tickets: analysis.quickWins.slice(0, 3),
        impact: 'Boost team productivity and customer satisfaction'
      });
    }

    // Old tickets recommendation
    if (analysis.oldTickets.length > 0) {
      const reallyOld = analysis.oldTickets.filter(t => t.daysSinceCreated >= 30);
      if (reallyOld.length > 0) {
        recommendations.push({
          priority: 'medium',
          action: 'Review Old Tickets',
          message: `${reallyOld.length} tickets are over 30 days old`,
          tickets: reallyOld.slice(0, 3),
          impact: 'Clean up backlog and prevent customer escalation'
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  generateSummary(analysis) {
    return {
      totalTickets: analysis.totalTickets,
      openTickets: analysis.openTickets.length,
      unassigned: analysis.unassignedTickets.length,
      stale: analysis.staleTickets.length,
      quickWins: analysis.quickWins.length,
      systemGenerated: analysis.systemGeneratedTickets.length,
      userTickets: analysis.userTickets.length,
      oldTickets: analysis.oldTickets.length,
      recentActivity: analysis.recentActivity.length,
      assignmentRate: analysis.totalTickets > 0 
        ? Math.round(((analysis.totalTickets - analysis.unassignedTickets.length) / analysis.totalTickets) * 100)
        : 0,
      avgAge: analysis.openTickets.length > 0
        ? Math.round(analysis.openTickets.reduce((sum, t) => {
          return sum + differenceInDays(new Date(), t.IssueDate);
        }, 0) / analysis.openTickets.length)
        : 0
    };
  }
}

module.exports = BanyanTicketAnalyzer;