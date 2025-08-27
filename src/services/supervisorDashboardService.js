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
    
    // Generate comprehensive analysis with automated and static components
    const analysis = {
      immediate_sla_violations: this.findSLAViolations(ticketData.openTickets),
      no_tech_response_3days: this.findNoTechResponse3Days(ticketData),
      aging_buckets: this.createAgingBuckets(ticketData.openTickets),
      immediate_triage: this.findImmediateTriage(ticketData.openTickets),
      vip_alerts: this.findVIPTickets(ticketData.openTickets),
      quick_wins: await this.findQuickWins(ticketData.openTickets),
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
      const techEmail = ticket.Tech_Email || 'UNASSIGNED';
      
      // Assignment SLA violations
      if (slaAnalysis.assignment.status === 'VIOLATED') {
        violations.push({
          ticketId: ticket.IssueID,
          type: 'ASSIGNMENT',
          severity: 'CRITICAL',
          message: slaAnalysis.assignment.message,
          hoursOverdue: slaAnalysis.assignment.hoursOverdue,
          action: 'ASSIGN_IMMEDIATELY',
          assigned: techEmail,
          assignedUsername: ticket.Tech_Username || '',
          subject: (ticket.Subject || '').substring(0, 60),
          url: `http://helpdesk/Ticket/${ticket.IssueID}`
        });
      }
      
      // First response SLA violations  
      if (slaAnalysis.firstResponse.status === 'VIOLATED') {
        // Check if there's already been a response by looking for "No response" in message
        const noResponseYet = slaAnalysis.firstResponse.message && 
                             slaAnalysis.firstResponse.message.includes('No response');
        
        violations.push({
          ticketId: ticket.IssueID,
          type: 'FIRST_RESPONSE',
          severity: slaAnalysis.firstResponse.hoursOverdue > 24 ? 'CRITICAL' : 'HIGH',
          message: slaAnalysis.firstResponse.message,
          hoursOverdue: slaAnalysis.firstResponse.hoursOverdue,
          action: noResponseYet ? 'INITIAL_RESPONSE_REQUIRED' : 'REVIEW_SLA_COMPLIANCE',
          assigned: techEmail,
          assignedUsername: ticket.Tech_Username || '',
          subject: (ticket.Subject || '').substring(0, 60),
          url: `http://helpdesk/Ticket/${ticket.IssueID}`
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
      const techEmail = alert.ticket.Tech_Email || 'UNASSIGNED';
      
      noResponseTickets.push({
        ticketId: alert.ticket.IssueID,
        daysSinceCreated: alert.daysSinceCreated,
        daysSinceLastTechResponse: alert.lastTechResponse ? 
          this.calculateAge(alert.lastTechResponse.date) : alert.daysSinceCreated,
        assigned: techEmail,
        assignedUsername: alert.ticket.Tech_Username || '',
        subject: (alert.ticket.Subject || '').substring(0, 70),
        status: alert.ticket.Current_Status || 'New',
        urgencyLevel: alert.urgencyLevel,
        url: `http://helpdesk/Ticket/${alert.ticket.IssueID}`
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
          url: `http://helpdesk/Ticket/${ticket.IssueID}`
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
      
      // Check if submitter or content contains VIP indicators and track reason
      let vipReason = null;
      let matchedTerm = null;
      
      for (const vipTerm of this.vipUsers) {
        // Create regex with word boundaries to avoid false matches like 'hector' containing 'cto'
        const vipRegex = new RegExp(`\\b${vipTerm}\\b`, 'i');
        
        if (vipRegex.test(submitter)) {
          vipReason = 'VIP Submitter';
          matchedTerm = vipTerm;
          break;
        }
        if (vipRegex.test(subject)) {
          vipReason = 'VIP in Subject';
          matchedTerm = vipTerm;
          break;
        }
        if (vipRegex.test(body)) {
          vipReason = 'VIP Mentioned';
          matchedTerm = vipTerm;
          break;
        }
      }
      
      if (vipReason) {
        const submitterEmail = this.getTechEmail(ticket.Submitted_By);
        const assignedEmail = ticket.Tech_Email || 'UNASSIGNED';
        
        vipTickets.push({
          ticketId: ticket.IssueID,
          submitter: submitterEmail,
          submitterUsername: ticket.Submitted_By ? (ticket.Submitted_By.includes('\\') ? ticket.Submitted_By.split('\\')[1] : ticket.Submitted_By.split('@')[0]) : '',
          subject: (ticket.Subject || '').substring(0, 80),
          age: this.calculateAge(ticket.IssueDate),
          assigned: assignedEmail,
          assignedUsername: ticket.Tech_Username || '',
          vipReason: vipReason,
          vipTerm: matchedTerm,
          url: `http://helpdesk/Ticket/${ticket.IssueID}`
        });
      }
    });
    
    return vipTickets.slice(0, 10);
  }

  async findQuickWins(openTickets) {
    // Send ALL tickets under 7 days old to AI for analysis
    // Let AI determine what's a quick win, not static keywords
    const recentTickets = openTickets.filter(ticket => {
      const age = this.calculateAge(ticket.IssueDate);
      return age <= 3; // Focus on tickets from last 3 days only
    });
    
    // Sort by age (newest first) and take top 30 for AI analysis
    const quickWinCandidates = recentTickets
      .sort((a, b) => new Date(b.IssueDate) - new Date(a.IssueDate))
      .slice(0, 30); // Analyze more tickets
    
    if (quickWinCandidates.length === 0) return [];
    
    try {
      const prompt = this.buildQuickWinsPrompt(quickWinCandidates);
      console.log('🤖 Calling AI for Quick Wins analysis...');
      console.log('📝 Sending prompt to AI with', quickWinCandidates.length, 'candidates');
      const response = await this.aiService.analyzeWithCheapModel(prompt);
      console.log('📦 AI Response received:', response ? 'Yes' : 'No');
      const parsed = this.parseQuickWinsResponse(response);
      console.log('🔍 Parsed results:', parsed.length, 'tickets');
      
      // Add URL to each result
      const resultsWithUrls = parsed.map(item => ({
        ...item,
        url: `http://helpdesk/Ticket/${item.ticketId}`
      }));
      
      console.log(`✅ AI analyzed ${resultsWithUrls.length} quick win tickets`);
      return resultsWithUrls;
    } catch (error) {
      console.error('❌ AI analysis failed with error:', error);
      console.error('Error details:', error.message, error.response?.data || '');
      console.log('⚠️ Falling back to keyword-based analysis due to AI error');
      
      // Return keyword-based quick wins as fallback
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
        const techEmail = ticket.Tech_Email || 'UNASSIGNED';
        
        candidates.push({
          ticketId: ticket.IssueID,
          reason: 'No user response for 7+ days',
          lastActivity: `${lastResponseDays} days ago`,
          assigned: techEmail,
          subject: (ticket.Subject || '').substring(0, 60),
          url: `http://helpdesk/Ticket/${ticket.IssueID}`
        });
      }
    });
    
    return candidates.slice(0, 15);
  }

  analyzeTechPerformance(openTickets) {
    const techStats = {};
    
    openTickets.forEach(ticket => {
      const techEmail = ticket.Tech_Email;
      if (!techEmail || techEmail.trim() === '') return;
      
      // Use email directly for display
      
      if (!techStats[techEmail]) {
        techStats[techEmail] = {
          originalName: ticket.Tech_Assigned_Clean || techEmail,
          totalTickets: 0,
          oldTickets: 0,
          avgAge: 0,
          noResponseCount: 0
        };
      }
      
      const age = this.calculateAge(ticket.IssueDate);
      techStats[techEmail].totalTickets++;
      techStats[techEmail].avgAge += age;
      
      if (age > 14) techStats[techEmail].oldTickets++;
      if (age > 3) techStats[techEmail].noResponseCount++; // Simplified check
    });
    
    // Calculate averages and trends
    Object.keys(techStats).forEach(techEmail => {
      techStats[techEmail].avgAge = Math.round(techStats[techEmail].avgAge / techStats[techEmail].totalTickets);
      techStats[techEmail].oldTicketPercent = Math.round((techStats[techEmail].oldTickets / techStats[techEmail].totalTickets) * 100);
    });
    
    return techStats;
  }

  getTechEmail(techName) {
    // Convert domain\username to email format
    if (!techName) return techName;
    
    if (techName.includes('\\')) {
      const parts = techName.split('\\');
      const username = parts[parts.length - 1];
      return `${username.toLowerCase()}@banyancenters.com`;
    }
    
    // If already in email format or just a name, return as is
    return techName;
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

    return `You are an experienced IT helpdesk supervisor analyzing tickets to identify quick wins (resolvable in under 30 minutes).
Evaluate which tickets can be resolved quickly and provide secure, best-practice solutions.

TICKETS TO ANALYZE:
${JSON.stringify(ticketSamples, null, 2)}

Return a JSON array with ONLY tickets that can be resolved in under 30 minutes:
[{
  "ticketId": "123",
  "aiAnalysis": "Specific 5-10 word description of the actual problem",
  "quickAction": "Exact secure action tech should take",
  "category": "Access|Hardware|Software|Network|Email|Performance",
  "estimatedMinutes": 5
}]

CRITICAL SECURITY & BEST PRACTICE RULES:
- NEVER grant admin rights for software installations - use deployment tools or IT-managed installation
- For audio issues: First check audio settings, drivers, and device manager BEFORE suggesting hardware
- For access requests: Verify manager approval first, then grant MINIMAL required permissions only
- For software issues: Try repair/reinstall/profile rebuild BEFORE suggesting new licenses or purchases  
- For hardware issues: Always attempt troubleshooting (drivers, connections, settings) before replacement
- For OneNote/Office updates: Use deployment tools or SCCM, never local admin rights
- For KIPU/application access: Verify with manager, then request through proper channels (not direct DB access)
- For profile issues: Try profile repair/reset before recreation

QUICK WIN CRITERIA:
- Password resets (verify identity first)
- Printer queue clears and driver reinstalls  
- Outlook profile rebuilds
- Mapped drive reconnections
- Simple software reinstalls via deployment tools
- Audio/display troubleshooting (settings and drivers)
- Browser cache/cookie clears
- VPN client resets

EXCLUDE these (not quick wins):
- New hardware purchases
- Complex permission changes  
- Tickets requiring manager approval
- License purchases
- Database access changes
- Anything requiring admin rights to user

Be specific but security-conscious in your recommendations.`;
  }

  parseQuickWinsResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.log('Failed to parse quick wins response');
      return [];
    }
  }

  createKeywordQuickWins(candidates) {
    // Simple fallback when AI is unavailable
    return candidates.slice(0, 5).map(ticket => {
      const subject = (ticket.Subject || '').toLowerCase();
      const body = (ticket.Ticket_Body || '').substring(0, 100).toLowerCase();
      
      // More specific AI-like analysis based on keywords and content
      let aiAnalysis = 'Quick resolution ticket needs review';
      let quickAction = 'Review ticket and assign to appropriate tech';
      let category = 'General';
      
      // Try to extract better analysis from subject line
      if (!subject && !body) {
        aiAnalysis = 'Empty ticket needs investigation';
        quickAction = 'Contact user for more details';
      } else if (subject.length > 0) {
        // Use first 40 chars of subject as analysis if nothing else matches
        aiAnalysis = subject.substring(0, 40);
        quickAction = 'Analyze issue and provide solution';
      }
      
      // More specific password analysis with security best practices
      if (subject.includes('password') || body.includes('password')) {
        if (subject.includes('reset') || body.includes('reset')) {
          aiAnalysis = 'User requesting password reset for account';
          quickAction = 'Verify identity, reset in AD, force change on next login';
        } else if (subject.includes('expired') || body.includes('expired')) {
          aiAnalysis = 'Password expired and needs renewal';
          quickAction = 'Reset password, verify expiration policy is appropriate';
        } else {
          aiAnalysis = 'Password issue preventing system access';
          quickAction = 'Check AD account status and reset if needed';
        }
        category = 'Access';
      } else if (subject.includes('unlock') || body.includes('locked out')) {
        aiAnalysis = 'User account locked after failed login attempts';
        quickAction = 'Unlock account in AD and verify user identity';
        category = 'Access';
      } else if (subject.includes('printer') || body.includes('printer')) {
        if (body.includes('jam') || subject.includes('jam')) {
          aiAnalysis = 'Printer has paper jam needs clearing';
          quickAction = 'Clear jam and test print functionality';
        } else if (body.includes('offline') || subject.includes('offline')) {
          aiAnalysis = 'Printer showing offline on user workstation';
          quickAction = 'Restart spooler service and check network connection';
        } else {
          aiAnalysis = 'Printer not functioning properly for user';
          quickAction = 'Check driver installation and spooler service';
        }
        category = 'Hardware';
      } else if (subject.includes('access') || body.includes('permission')) {
        if (body.includes('share') || body.includes('folder')) {
          aiAnalysis = 'User needs access to network shared folder';
          quickAction = 'Verify manager approval, add to appropriate security group';
        } else if (body.includes('application') || body.includes('software')) {
          aiAnalysis = 'User needs access to specific application';
          quickAction = 'Check approval, grant minimal required permissions only';
        } else {
          aiAnalysis = 'User requesting additional system permissions';
          quickAction = 'Review request and grant appropriate access level';
        }
        category = 'Access';
      } else if (subject.includes('keyboard') || subject.includes('mouse')) {
        aiAnalysis = 'Input device not working at workstation';
        quickAction = 'Test USB ports and replace device if faulty';
        category = 'Hardware';
      } else if (subject.includes('monitor') || subject.includes('screen')) {
        if (body.includes('black') || body.includes('blank')) {
          aiAnalysis = 'Monitor displaying black or blank screen';
          quickAction = 'Check cables, test with different port, update drivers';
        } else {
          aiAnalysis = 'Display issue affecting user productivity';
          quickAction = 'Check display settings, resolution, and driver updates';
        }
        category = 'Hardware';
      } else if (subject.includes('email') || body.includes('outlook')) {
        aiAnalysis = 'Email client issue preventing message access';
        quickAction = 'Rebuild Outlook profile and clear cache';
        category = 'Software';
      } else if (subject.includes('slow') || body.includes('performance')) {
        aiAnalysis = 'Computer running slowly affecting productivity';
        quickAction = 'Check disk space and running processes';
        category = 'Performance';
      } else if (subject.includes('vpn')) {
        aiAnalysis = 'VPN connection issue preventing remote work';
        quickAction = 'Reset VPN client and check credentials';
        category = 'Network';
      } else if (subject.includes('install') || body.includes('install')) {
        aiAnalysis = 'Software installation request from user';
        quickAction = 'Deploy via SCCM/deployment tools, never grant admin';
        category = 'Software';
      } else if (subject.includes('update') || body.includes('update')) {
        aiAnalysis = 'Software update needed on workstation';
        quickAction = 'Push updates via deployment tools or WSUS';
        category = 'Software';
      } else if (subject.includes('reboot') || subject.includes('restart')) {
        aiAnalysis = 'System requires reboot to resolve issue';
        quickAction = 'Schedule reboot with user and verify fix';
        category = 'Maintenance';
      } else if (subject.includes('mapped') || subject.includes('drive')) {
        aiAnalysis = 'Network drive mapping issue for user';
        quickAction = 'Remap drive letter and verify permissions';
        category = 'Network';
      }
      
      return {
        ticketId: ticket.IssueID,
        aiAnalysis: aiAnalysis,
        quickAction: quickAction,
        category: category,
        matchedKeywords: ticket._matchedKeywords || [],
        url: `http://helpdesk/Ticket/${ticket.IssueID}`
      };
    });
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
        quickWins: analysis.quick_wins?.length || 0,
        closureCandidates: analysis.closure_candidates?.length || 0
      },
      sections: {
        sla_violations: analysis.immediate_sla_violations,
        no_tech_response_3days: analysis.no_tech_response_3days,
        aging_analysis: analysis.aging_buckets,
        immediate_triage: analysis.immediate_triage,
        vip_alerts: analysis.vip_alerts,
        quick_wins: analysis.quick_wins,
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