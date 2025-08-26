// Supervisor Dashboard Service - Actionable daily supervisor insights
const SmartAIService = require('./smartAIService');
const TicketSLAPolicy = require('../utils/ticketSLAPolicy');

class SupervisorDashboardService {
  constructor() {
    this.aiService = new SmartAIService();
    this.slaPolicy = new TicketSLAPolicy();
    this.vipUsers = ['director', 'vp', 'vice president', 'ceo', 'cfo', 'cto', 'president', 'executive']; // Will move to config file
  }

  async generateSupervisorDailyReport(ticketData) {
    console.log('📊 Generating actionable supervisor dashboard...');
    console.log(`🔍 Input data: ${ticketData.openTickets?.length || 0} open tickets, ${ticketData.noResponseAlerts?.length || 0} no-response alerts, ${ticketData.stuckTickets?.length || 0} stuck tickets`);
    
    // Generate comprehensive analysis with AI and static components
    const analysis = {
      immediate_sla_violations: this.findSLAViolations(ticketData.openTickets),
      no_tech_response_3days: this.findNoTechResponse3Days(ticketData),
      aging_buckets: this.createAgingBuckets(ticketData.openTickets),
      immediate_triage: this.findImmediateTriage(ticketData.openTickets),
      vip_alerts: this.findVIPTickets(ticketData.openTickets),
      ai_quick_wins: await this.findAIQuickWins(ticketData.openTickets),
      closure_candidates: this.findClosureCandidates(ticketData.openTickets),
      tech_performance: this.analyzeTechPerformance(ticketData.openTickets)
    };
    
    console.log(`📋 Dashboard sections: ${Object.keys(analysis).length} actionable categories`);
    
    return this.formatNewSupervisorReport(analysis, ticketData);
  }

  findSLAViolations(openTickets) {
    const violations = [];
    const now = new Date();
    
    openTickets.forEach(ticket => {
      const slaAnalysis = this.slaPolicy.analyzeSLA(ticket);
      
      // Assignment SLA violations
      if (slaAnalysis.assignment.status === 'VIOLATED') {
        violations.push({
          ticketId: ticket.IssueID,
          type: 'ASSIGNMENT',
          severity: 'CRITICAL',
          message: slaAnalysis.assignment.message,
          hoursOverdue: slaAnalysis.assignment.hoursOverdue,
          action: 'ASSIGN_IMMEDIATELY',
          url: `http://helpdesk/${ticket.IssueID}`
        });
      }
      
      // First response SLA violations  
      if (slaAnalysis.firstResponse.status === 'VIOLATED') {
        violations.push({
          ticketId: ticket.IssueID,
          type: 'FIRST_RESPONSE',
          severity: slaAnalysis.firstResponse.hoursOverdue > 24 ? 'CRITICAL' : 'HIGH',
          message: slaAnalysis.firstResponse.message,
          hoursOverdue: slaAnalysis.firstResponse.hoursOverdue,
          action: 'RESPOND_NOW',
          url: `http://helpdesk/${ticket.IssueID}`
        });
      }
    });
    
    return violations.sort((a, b) => b.hoursOverdue - a.hoursOverdue).slice(0, 15);
  }

  findNoTechResponse3Days(ticketData) {
    const noResponseTickets = [];
    
    if (!ticketData.noResponseAlerts) return noResponseTickets;
    
    // Use the existing no-response alerts (already 3+ days with no tech response)
    ticketData.noResponseAlerts.forEach(alert => {
      noResponseTickets.push({
        ticketId: alert.ticket.IssueID,
        daysSinceCreated: alert.daysSinceCreated,
        daysSinceLastTechResponse: alert.lastTechResponse ? 
          this.calculateAge(alert.lastTechResponse.date) : alert.daysSinceCreated,
        assigned: alert.ticket.Tech_Assigned_Clean || 'UNASSIGNED',
        subject: (alert.ticket.Subject || '').substring(0, 70),
        priority: this.getPriorityLevel(alert.ticket.Priority),
        urgencyLevel: alert.urgencyLevel,
        url: `http://helpdesk/${alert.ticket.IssueID}`
      });
    });
    
    return noResponseTickets
      .sort((a, b) => b.urgencyLevel - a.urgencyLevel)
      .slice(0, 25); // Show more since this is a key metric
  }

  createAgingBuckets(openTickets) {
    const buckets = {
      '0-3_days': [],
      '4-7_days': [],
      '8-14_days': [],
      '15-21_days': [],
      '22+_days': []
    };
    
    openTickets.forEach(ticket => {
      const age = this.calculateAge(ticket.IssueDate);
      
      if (age <= 3) buckets['0-3_days'].push(ticket.IssueID);
      else if (age <= 7) buckets['4-7_days'].push(ticket.IssueID);
      else if (age <= 14) buckets['8-14_days'].push(ticket.IssueID);
      else if (age <= 21) buckets['15-21_days'].push(ticket.IssueID);
      else buckets['22+_days'].push(ticket.IssueID);
    });
    
    return {
      buckets,
      summary: {
        total: openTickets.length,
        aging_concern: buckets['15-21_days'].length,
        critical_aging: buckets['22+_days'].length
      }
    };
  }

  findImmediateTriage(openTickets) {
    const triage = [];
    const now = new Date();
    
    openTickets.forEach(ticket => {
      const createdHoursAgo = (now - new Date(ticket.IssueDate)) / (1000 * 60 * 60);
      
      // New tickets needing assignment (within 4 hours)
      if (!ticket.Tech_Assigned_Clean && createdHoursAgo <= 4) {
        triage.push({
          ticketId: ticket.IssueID,
          priority: this.getPriorityLevel(ticket.Priority),
          reason: 'New unassigned ticket',
          age: `${createdHoursAgo.toFixed(1)} hours`,
          subject: (ticket.Subject || '').substring(0, 60),
          url: `http://helpdesk/${ticket.IssueID}`
        });
      }
    });
    
    return triage.sort((a, b) => this.priorityWeight(a.priority) - this.priorityWeight(b.priority)).slice(0, 10);
  }

  findVIPTickets(openTickets) {
    const vipTickets = [];
    
    openTickets.forEach(ticket => {
      const submitter = (ticket.Submitted_By || '').toLowerCase();
      const subject = (ticket.Subject || '').toLowerCase();
      const body = (ticket.Ticket_Body || '').toLowerCase();
      
      // Check if submitter or content contains VIP indicators
      const isVIP = this.vipUsers.some(vipTerm => 
        submitter.includes(vipTerm) || 
        subject.includes(vipTerm) || 
        body.includes(vipTerm)
      );
      
      if (isVIP) {
        vipTickets.push({
          ticketId: ticket.IssueID,
          submitter: ticket.Submitted_By,
          subject: (ticket.Subject || '').substring(0, 80),
          age: this.calculateAge(ticket.IssueDate),
          assigned: ticket.Tech_Assigned_Clean || 'UNASSIGNED',
          url: `http://helpdesk/${ticket.IssueID}`
        });
      }
    });
    
    return vipTickets.slice(0, 10);
  }

  async findAIQuickWins(openTickets) {
    const quickWinCandidates = openTickets.filter(ticket => {
      const subject = (ticket.Subject || '').toLowerCase();
      const body = (ticket.Ticket_Body || '').toLowerCase();
      
      // Look for common quick-win keywords
      const quickWinKeywords = [
        'password', 'reset', 'unlock', 'keyboard', 'mouse', 'cable',
        'printer', 'monitor', 'access', 'permission', 'login'
      ];
      
      return quickWinKeywords.some(keyword => 
        subject.includes(keyword) || body.includes(keyword)
      );
    }).slice(0, 20); // Limit for AI analysis
    
    if (quickWinCandidates.length === 0) return [];
    
    try {
      const aiPrompt = this.buildQuickWinsPrompt(quickWinCandidates);
      const aiResponse = await this.aiService.analyzeWithCheapModel(aiPrompt);
      return this.parseQuickWinsResponse(aiResponse);
    } catch (error) {
      console.log('AI quick wins analysis failed, using keyword fallback');
      return this.createKeywordQuickWins(quickWinCandidates);
    }
  }

  findClosureCandidates(openTickets) {
    const candidates = [];
    
    openTickets.forEach(ticket => {
      if (!ticket.comments) return;
      
      // Look for patterns indicating potential closure
      const comments = ticket.comments.toLowerCase();
      const lastResponseDays = this.calculateAge(ticket.IssueDate);
      
      // Tickets waiting for user response for 7+ days
      if (lastResponseDays >= 7 && (
        comments.includes('waiting for user') ||
        comments.includes('awaiting response') ||
        comments.includes('please confirm')
      )) {
        candidates.push({
          ticketId: ticket.IssueID,
          reason: 'No user response for 7+ days',
          lastActivity: `${lastResponseDays} days ago`,
          assigned: ticket.Tech_Assigned_Clean,
          url: `http://helpdesk/${ticket.IssueID}`
        });
      }
    });
    
    return candidates.slice(0, 15);
  }

  analyzeTechPerformance(openTickets) {
    const techStats = {};
    
    openTickets.forEach(ticket => {
      const tech = ticket.Tech_Assigned_Clean;
      if (!tech || tech.trim() === '') return;
      
      if (!techStats[tech]) {
        techStats[tech] = {
          totalTickets: 0,
          oldTickets: 0,
          avgAge: 0,
          noResponseCount: 0
        };
      }
      
      const age = this.calculateAge(ticket.IssueDate);
      techStats[tech].totalTickets++;
      techStats[tech].avgAge += age;
      
      if (age > 14) techStats[tech].oldTickets++;
      if (age > 3) techStats[tech].noResponseCount++; // Simplified check
    });
    
    // Calculate averages and trends
    Object.keys(techStats).forEach(tech => {
      techStats[tech].avgAge = Math.round(techStats[tech].avgAge / techStats[tech].totalTickets);
      techStats[tech].oldTicketPercent = Math.round((techStats[tech].oldTickets / techStats[tech].totalTickets) * 100);
    });
    
    return techStats;
  }

  createDirectPriorities(ticketData) {
    const priorities = [];
    
    // High priority: Unassigned tickets with no response
    const unassignedNoResponse = (ticketData.noResponseAlerts || []).filter(alert => 
      !alert.ticket.Tech_Assigned || alert.ticket.Tech_Assigned.trim() === ''
    );
    
    if (unassignedNoResponse.length > 0) {
      priorities.push({
        priority: "CRITICAL",
        action: `Assign ${unassignedNoResponse.length} unassigned tickets with no tech response`,
        tickets: unassignedNoResponse.slice(0, 10).map(alert => alert.ticket.IssueID),
        assigned_tech: "UNASSIGNED",
        why: "Unassigned tickets violate SLA and may be overlooked"
      });
    }
    
    // High priority: Assigned tickets with no response for 3+ days
    const assignedNoResponse = (ticketData.noResponseAlerts || []).filter(alert => 
      alert.ticket.Tech_Assigned && alert.ticket.Tech_Assigned.trim() !== ''
    );
    
    if (assignedNoResponse.length > 0) {
      priorities.push({
        priority: "HIGH", 
        action: `Follow up on ${assignedNoResponse.length} assigned tickets with no recent tech response`,
        tickets: assignedNoResponse.slice(0, 10).map(alert => alert.ticket.IssueID),
        assigned_tech: "MULTIPLE",
        why: "Tickets have been assigned but technicians haven't responded in 3+ days"
      });
    }
    
    return priorities;
  }

  createSLARisks(ticketData) {
    const risks = [];
    
    // Any ticket with no response for 3+ days is an SLA risk
    (ticketData.noResponseAlerts || []).slice(0, 10).forEach(alert => {
      risks.push({
        ticket_id: alert.ticket.IssueID,
        risk_level: alert.daysSinceCreated > 7 ? "HIGH" : "MEDIUM",
        days_to_breach: Math.max(0, 5 - alert.daysSinceCreated), // Assuming 5-day SLA
        recommended_action: alert.daysSinceCreated > 7 ? "escalate" : "expedite"
      });
    });
    
    return risks;
  }

  buildSupervisorDashboardPrompt(ticketData) {
    const openTickets = ticketData.openTickets;
    const noResponseAlerts = ticketData.noResponseAlerts || [];
    const stuckTickets = ticketData.stuckTickets || [];
    
    // Prepare ticket samples for AI context
    const ticketSamples = openTickets.slice(0, 10).map(ticket => ({
      id: ticket.IssueID,
      subject: (ticket.Subject || '').substring(0, 80),
      age_days: this.calculateAge(ticket.IssueDate),
      status: ticket.Current_Status,
      tech_assigned: ticket.Tech_Assigned_Clean || 'UNASSIGNED',
      priority: ticket.Priority || 'Normal',
      has_comments: (ticket.comments || '').length > 0
    }));

    return `You are an experienced helpdesk supervisor starting your workday. Analyze today's ticket data and provide actionable guidance for managing your team and ensuring SLA compliance.

UNDERSTANDING THE DATA STRUCTURE:
================================
- IssueID: Unique ticket identifier
- IssueDate: When ticket was created (use to calculate age)
- Tech_Assigned_Clean: Which technician is assigned (empty = unassigned)
- Subject: Brief description of the issue
- Ticket_Body: Original user request details
- Current_Status: Ticket status (New, In Progress, Waiting, etc.)
- Priority: Normal, High, Critical (affects SLA)
- comments: All communication history (IMPORTANT: distinguish user responses from tech responses)

CRITICAL DISTINCTIONS:
- User responses asking "any updates?" are NOT tech responses
- Only count actual tech work/communication as tech activity
- "Waiting" status often means waiting for user, not tech delay
- Unassigned tickets are immediate red flags

TODAY'S TICKET DATA:
===================
Total Open Tickets: ${openTickets.length}
No Response Alerts (72+ hours): ${noResponseAlerts.length}
Stuck Tickets (14+ days): ${stuckTickets.length}
Unassigned Tickets: ${openTickets.filter(t => !t.Tech_Assigned_Clean).length}

SAMPLE TICKETS (first 10):
${JSON.stringify(ticketSamples, null, 2)}

ALERTS REQUIRING ATTENTION:
- No Response Alerts: ${noResponseAlerts.slice(0, 5).map(alert => `#${alert.ticket.IssueID} (${alert.daysSinceCreated} days)`).join(', ')}
- Stuck Tickets: ${stuckTickets.slice(0, 5).map(stuck => `#${stuck.ticket.IssueID} (${stuck.age} days)`).join(', ')}

YOUR TASK AS SUPERVISOR:
========================
Provide a focused daily briefing covering:

1. **IMMEDIATE ACTION ITEMS** - What needs your attention TODAY
2. **SLA RISK ASSESSMENT** - Which tickets are approaching/violating SLAs
3. **TEAM PERFORMANCE INSIGHTS** - Who needs coaching, who's excelling
4. **WORKLOAD DISTRIBUTION** - Is work balanced across technicians?
5. **PROCESS ISSUES** - Are there patterns indicating system problems?

Focus on actionable items - what you need to do, who you need to talk to, what needs to be escalated.

Respond in JSON format:
{
  "daily_priorities": [
    {
      "priority": "CRITICAL|HIGH|MEDIUM",
      "action": "specific action to take",
      "tickets": ["ticket_ids"],
      "assigned_tech": "tech_name or UNASSIGNED",
      "why": "business justification"
    }
  ],
  "team_coaching": [
    {
      "tech_name": "technician_name",
      "issue": "specific performance concern",
      "coaching_action": "what to discuss with them",
      "tickets": ["example_ticket_ids"]
    }
  ],
  "sla_risks": [
    {
      "ticket_id": "ticket_number",
      "risk_level": "HIGH|MEDIUM",
      "days_to_breach": "number",
      "recommended_action": "escalate|reassign|expedite"
    }
  ],
  "positive_highlights": [
    {
      "tech_name": "technician_name", 
      "achievement": "what they did well",
      "impact": "business benefit"
    }
  ],
  "system_recommendations": [
    {
      "issue": "process or system problem identified",
      "impact": "effect on team/customers", 
      "suggested_fix": "how to improve"
    }
  ]
}

Remember: You're helping a supervisor manage people and processes, not just reporting statistics.`;
  }

  formatSupervisorReport(analysis, ticketData) {
    const criticalCount = analysis.daily_priorities?.filter(p => p.priority === 'CRITICAL').length || 0;
    const highCount = analysis.daily_priorities?.filter(p => p.priority === 'HIGH').length || 0;
    
    console.log(`📊 Summary counts: Critical=${criticalCount}, High=${highCount}, SLA Risks=${analysis.sla_risks?.length || 0}`);
    
    return {
      type: 'supervisor_daily_dashboard',
      generated: new Date().toISOString(),
      summary: {
        totalOpen: ticketData.openTickets.length,
        criticalActions: criticalCount + highCount, // Include both CRITICAL and HIGH as "critical actions"
        slaRisks: analysis.sla_risks?.length || 0,
        teamIssues: analysis.team_coaching?.length || 0
      },
      analysis,
      ticketCounts: {
        unassigned: ticketData.openTickets.filter(t => !t.Tech_Assigned_Clean).length,
        noResponse: ticketData.noResponseAlerts?.length || 0,
        stuck: ticketData.stuckTickets?.length || 0
      }
    };
  }

  getFallbackReport(ticketData) {
    return {
      type: 'supervisor_daily_dashboard',
      generated: new Date().toISOString(),
      summary: {
        totalOpen: ticketData.openTickets.length,
        criticalActions: ticketData.openTickets.filter(t => !t.Tech_Assigned_Clean).length,
        slaRisks: ticketData.noResponseAlerts?.length || 0,
        teamIssues: 0
      },
      analysis: {
        daily_priorities: [
          {
            priority: "HIGH",
            action: "Review unassigned tickets - AI analysis unavailable",
            tickets: ticketData.openTickets.filter(t => !t.Tech_Assigned_Clean).map(t => t.IssueID),
            assigned_tech: "UNASSIGNED",
            why: "Unassigned tickets violate SLA"
          }
        ],
        team_coaching: [],
        sla_risks: [],
        positive_highlights: [],
        system_recommendations: [
          {
            issue: "AI analysis service unavailable",
            impact: "Manual review required for insights",
            suggested_fix: "Check AI service configuration"
          }
        ]
      },
      ticketCounts: {
        unassigned: ticketData.openTickets.filter(t => !t.Tech_Assigned_Clean).length,
        noResponse: ticketData.noResponseAlerts?.length || 0,
        stuck: ticketData.stuckTickets?.length || 0
      }
    };
  }

  calculateAge(dateString) {
    if (!dateString) return 0;
    const created = new Date(dateString);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  // Helper methods for new dashboard
  getPriorityLevel(priority) {
    const p = (priority || '').toLowerCase();
    if (p.includes('critical') || p.includes('urgent')) return 'CRITICAL';
    if (p.includes('high')) return 'HIGH';
    return 'NORMAL';
  }

  priorityWeight(priority) {
    const weights = { 'CRITICAL': 1, 'HIGH': 2, 'NORMAL': 3 };
    return weights[priority] || 4;
  }

  buildQuickWinsPrompt(tickets) {
    const ticketSamples = tickets.slice(0, 10).map(ticket => ({
      id: ticket.IssueID,
      subject: (ticket.Subject || '').substring(0, 80),
      body: (ticket.Ticket_Body || '').substring(0, 200),
      age: this.calculateAge(ticket.IssueDate)
    }));

    return `Analyze these helpdesk tickets and identify which ones are likely quick wins (can be resolved in <30 minutes):

${JSON.stringify(ticketSamples, null, 2)}

Return JSON array of quick win ticket IDs with reasons:
[{"ticketId": "123", "reason": "Simple password reset", "estimatedMinutes": 15}]`;
  }

  parseQuickWinsResponse(aiResponse) {
    try {
      return JSON.parse(aiResponse);
    } catch (error) {
      console.log('Failed to parse AI quick wins response');
      return [];
    }
  }

  createKeywordQuickWins(candidates) {
    return candidates.slice(0, 5).map(ticket => ({
      ticketId: ticket.IssueID,
      reason: 'Contains quick-win keywords',
      estimatedMinutes: 20,
      url: `http://helpdesk/${ticket.IssueID}`
    }));
  }

  formatNewSupervisorReport(analysis, ticketData) {
    const totalViolations = analysis.immediate_sla_violations?.length || 0;
    const criticalAging = analysis.aging_buckets?.summary?.critical_aging || 0;
    const immediateTriage = analysis.immediate_triage?.length || 0;
    const vipCount = analysis.vip_alerts?.length || 0;
    const noTechResponse3Days = analysis.no_tech_response_3days?.length || 0;
    
    return {
      type: 'actionable_supervisor_dashboard',
      generated: new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}),
      summary: {
        totalOpen: ticketData.openTickets.length,
        slaViolations: totalViolations,
        noTechResponse3Days: noTechResponse3Days,
        criticalAging: criticalAging,
        immediateTriage: immediateTriage,
        vipAlerts: vipCount,
        quickWins: analysis.ai_quick_wins?.length || 0,
        closureCandidates: analysis.closure_candidates?.length || 0
      },
      sections: {
        sla_violations: analysis.immediate_sla_violations,
        no_tech_response_3days: analysis.no_tech_response_3days,
        aging_analysis: analysis.aging_buckets,
        immediate_triage: analysis.immediate_triage,
        vip_alerts: analysis.vip_alerts,
        quick_wins: analysis.ai_quick_wins,
        closure_candidates: analysis.closure_candidates,
        tech_performance: analysis.tech_performance
      },
      ticketCounts: {
        unassigned: ticketData.openTickets.filter(t => !t.Tech_Assigned_Clean).length,
        noResponse: ticketData.noResponseAlerts?.length || 0,
        stuck: ticketData.stuckTickets?.length || 0
      }
    };
  }
}

module.exports = SupervisorDashboardService;