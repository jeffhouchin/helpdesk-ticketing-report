const { differenceInBusinessDays, format } = require('date-fns');
const BusinessDayCalculator = require('../utils/businessDays');
const CSVParser = require('../utils/csvParser');
const CSVDebugger = require('../utils/csvDebugger');

class DailyIntelligenceEngine {
  constructor(claudeService = null, emailService = null) {
    this.businessDays = new BusinessDayCalculator();
    this.claudeService = claudeService;
    
    // Supervisor email for escalations
    this.supervisorEmail = process.env.SUPERVISOR_EMAIL || 'jhouchin@banyancenters.com';
    
    // AI evaluation criteria  
    this.evaluationCriteria = {
      noResponseThreshold: 3, // 72 hours = 3 business days
      stuckTicketThreshold: 14 // 14+ days
    };
  }

  async runDailyIntelligenceFromContent(csvContent, filename = 'unknown') {
    console.log('🧠 Starting Daily Helpdesk Intelligence Engine...');
    
    try {
      // Debug CSV content first
      console.log('🔍 DEBUG: About to debug CSV content');
      const csvAnalysis = CSVDebugger.analyzeCSVContent(csvContent);
      console.log('🔍 CSV ANALYSIS:', JSON.stringify(csvAnalysis, null, 2));
      
      // Parse CSV content directly
      console.log('🔍 DEBUG: About to parse CSV content with CSVParser');
      const csvParser = new CSVParser();
      const tickets = await csvParser.parseTicketCSVFromContent(csvContent);
      console.log('🔍 DEBUG: CSVParser completed, tickets found:', tickets.length);
      const openTickets = tickets.filter(ticket => this.isTicketOpen(ticket));
      const closedYesterday = this.getClosedYesterday(tickets);

      console.log(`📊 CSV File Size: ${csvContent?.length || 0} characters`);
      console.log(`📊 CSV Content: "${csvContent}"`);
      console.log(`📊 Total Tickets Parsed: ${tickets.length}`);
      console.log(`📊 Processing ${openTickets.length} open tickets, ${closedYesterday.length} closed yesterday`);

      // Run all analyses
      console.log('🔍 DEBUG: Starting analysis methods...');
      const analyses = {};
      
      console.log('🔍 DEBUG: Running generateDailyOverview...');
      analyses.dailyOverview = await this.generateDailyOverview(openTickets);
      console.log('🔍 DEBUG: generateDailyOverview completed');
      
      console.log('🔍 DEBUG: Running identify72HourNoResponse...');
      analyses.noResponseAlerts = await this.identify72HourNoResponse(openTickets);
      console.log('🔍 DEBUG: identify72HourNoResponse completed');
      
      console.log('🔍 DEBUG: Running evaluateStuckTickets...');
      analyses.stuckTicketEvaluations = await this.evaluateStuckTickets(openTickets);
      console.log('🔍 DEBUG: evaluateStuckTickets completed');
      
      // Performance reviews removed as requested by leadership
      
      console.log('🔍 DEBUG: Running analyzeClosedTickets...');
      analyses.closedTicketAnalysis = await this.analyzeClosedTickets(closedYesterday);
      console.log('🔍 DEBUG: analyzeClosedTickets completed');

      // Transform data structure to match email template expectations
      const transformedAnalyses = {
        summary: {
          ...analyses.dailyOverview,
          totalTickets: analyses.dailyOverview.totalOpen
        },
        noResponseAlerts: analyses.noResponseAlerts,
        stuckTickets: analyses.stuckTicketEvaluations,
        performanceReviews: [], // Disabled
        closedTickets: analyses.closedTicketAnalysis,
        // Add debug info to results
        debug: {
          filename: filename,
          csvFileSize: csvContent?.length || 0,
          csvContent: csvContent?.substring(0, 200) + (csvContent?.length > 200 ? '...' : ''),
          totalTicketsParsed: tickets.length,
          openTicketsFound: openTickets.length,
          closedYesterdayFound: closedYesterday.length
        }
      };

      // Analysis complete - email will be sent by caller

      console.log('✅ Daily Intelligence Engine completed successfully');
      return transformedAnalyses;

    } catch (error) {
      console.error('❌ Daily Intelligence Engine failed:', error);
      throw error;
    }
  }


  async generateDailyOverview(openTickets) {
    const overview = {
      totalOpen: openTickets.length,
      unassigned: openTickets.filter(t => !t.Tech_Assigned || t.Tech_Assigned.trim() === '').length,
      newToday: openTickets.filter(t => this.isCreatedToday(t)).length,
      highPriority: openTickets.filter(t => this.isHighPriority(t)).length,
      statusBreakdown: {},
      technicianWorkload: {},
      oldestTicket: null
    };

    // Status breakdown
    openTickets.forEach(ticket => {
      const status = ticket.Current_Status || 'Unknown';
      overview.statusBreakdown[status] = (overview.statusBreakdown[status] || 0) + 1;
    });

    // Technician workload
    openTickets.forEach(ticket => {
      if (ticket.Tech_Assigned_Clean) {
        const tech = ticket.Tech_Assigned_Clean;
        overview.technicianWorkload[tech] = (overview.technicianWorkload[tech] || 0) + 1;
      }
    });

    // Find oldest ticket
    if (openTickets.length > 0) {
      overview.oldestTicket = openTickets.reduce((oldest, ticket) => {
        const ticketAge = this.businessDays.getBusinessDaysSince(ticket.IssueDate);
        const oldestAge = this.businessDays.getBusinessDaysSince(oldest.IssueDate);
        return ticketAge > oldestAge ? ticket : oldest;
      });
    }

    return overview;
  }

  async identify72HourNoResponse(openTickets) {
    const alerts = [];
    let debugCount = 0;
    
    console.log(`🔍 DEBUG: Checking ${openTickets.length} open tickets for no-response alerts`);
    
    openTickets.forEach(ticket => {
      const daysSinceCreated = this.businessDays.getBusinessDaysSince(ticket.IssueDate);
      const lastTechResponse = this.getLastTechResponse(ticket);
      
      // Debug first 5 tickets
      if (debugCount < 5) {
        console.log(`🔍 DEBUG Ticket #${ticket.IssueID}: ${daysSinceCreated} days old, Tech Response: ${lastTechResponse ? 'YES' : 'NO'}`);
        if (ticket.comments) {
          console.log(`🔍 DEBUG Ticket #${ticket.IssueID} comments: ${ticket.comments.substring(0, 200)}...`);
        }
        debugCount++;
      }
      
      // Check if it's been 72+ hours (3 business days) with no tech response
      if (daysSinceCreated >= this.evaluationCriteria.noResponseThreshold) {
        if (!lastTechResponse || this.businessDays.getBusinessDaysSince(lastTechResponse.date) >= 3) {
          console.log(`🚨 ALERT: Ticket #${ticket.IssueID} has no tech response for ${daysSinceCreated} days`);
          alerts.push({
            ticket,
            daysSinceCreated,
            lastTechResponse,
            urgencyLevel: this.calculateUrgencyLevel(ticket, daysSinceCreated),
            recommendedAction: this.getNoResponseRecommendation(ticket, daysSinceCreated)
          });
        }
      }
    });

    console.log(`🔍 DEBUG: Found ${alerts.length} no-response alerts`);
    return alerts.sort((a, b) => b.urgencyLevel - a.urgencyLevel);
  }

  async evaluateStuckTickets(openTickets) {
    const stuckTickets = openTickets.filter(ticket => 
      this.businessDays.getBusinessDaysSince(ticket.IssueDate) >= this.evaluationCriteria.stuckTicketThreshold
    );

    const evaluations = [];

    for (const ticket of stuckTickets) {
      const evaluation = await this.aiEvaluateStuckTicket(ticket);
      evaluations.push(evaluation);
    }

    return evaluations;
  }

  async aiEvaluateStuckTicket(ticket) {
    const age = this.businessDays.getBusinessDaysSince(ticket.IssueDate);
    const comments = ticket.comments || '';
    const status = ticket.Current_Status || '';
    const techResponses = this.countTechResponses(ticket);
    const userResponses = this.countUserResponses(ticket);
    const lastActivity = this.getLastActivityDate(ticket);
    
    // AI Decision Logic
    let recommendation = 'unknown';
    let reasoning = [];
    let confidence = 0;

    // Rule 1: User non-responsive
    if (this.hasUserNonResponsePattern(ticket)) {
      recommendation = 'close_no_user_response';
      reasoning.push('Multiple tech attempts with no user response');
      confidence += 0.8;
    }
    
    // Rule 2: Complex project indicators
    else if (this.isComplexProject(ticket)) {
      recommendation = 'move_to_project_management';
      reasoning.push('Complex scope requiring project management');
      confidence += 0.7;
    }
    
    // Rule 3: Simple stuck ticket
    else if (age >= 30 && techResponses < 3) {
      recommendation = 'push_to_closure';
      reasoning.push('Long duration with minimal tech engagement');
      confidence += 0.6;
    }
    
    // Rule 4: Waiting status too long
    else if (status.toLowerCase().includes('waiting') && age >= 21) {
      recommendation = 'close_no_user_response';
      reasoning.push('Waiting status exceeded reasonable timeframe');
      confidence += 0.7;
    }
    
    // Rule 5: High activity but no resolution
    else if (techResponses >= 5 && userResponses >= 3 && age >= 21) {
      recommendation = 'escalate_management';
      reasoning.push('High engagement but no resolution - needs management review');
      confidence += 0.8;
    }

    return {
      ticket,
      age,
      recommendation,
      reasoning,
      confidence: Math.min(confidence, 1.0),
      metrics: {
        techResponses,
        userResponses,
        lastActivity: lastActivity ? this.businessDays.getBusinessDaysSince(lastActivity) : null
      },
      suggestedActions: this.generateActionPlan(recommendation, ticket)
    };
  }



  async analyzeClosedTickets(closedTickets) {
    const analysis = {
      totalClosed: closedTickets.length,
      avgResolutionTime: 0,
      resolutionQuality: {},
      commonIssues: {},
      technicianPerformance: {}
    };

    if (closedTickets.length === 0) return analysis;

    // Calculate average resolution time
    const resolutionTimes = closedTickets
      .filter(t => t.IssueDate)
      .map(t => this.businessDays.getBusinessDaysSince(t.IssueDate));
    
    analysis.avgResolutionTime = resolutionTimes.length > 0 
      ? Math.round(resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length)
      : 0;

    // Analyze each closed ticket
    for (const ticket of closedTickets) {
      const resolutionAnalysis = this.analyzeTicketResolution(ticket);
      
      // Update analysis data
      const tech = ticket.Tech_Assigned_Clean;
      if (tech) {
        if (!analysis.technicianPerformance[tech]) {
          analysis.technicianPerformance[tech] = {
            ticketsCompleted: 0,
            avgResolutionTime: 0,
            qualityScore: 0
          };
        }
        analysis.technicianPerformance[tech].ticketsCompleted++;
        analysis.technicianPerformance[tech].qualityScore += resolutionAnalysis.qualityScore;
      }
    }

    // Calculate averages
    Object.keys(analysis.technicianPerformance).forEach(tech => {
      const perf = analysis.technicianPerformance[tech];
      perf.qualityScore = Math.round(perf.qualityScore / perf.ticketsCompleted);
    });

    return analysis;
  }

  // Helper methods for analysis
  isTicketOpen(ticket) {
    const status = (ticket.Current_Status || '').toLowerCase();
    const closedStatuses = ['closed', 'resolved', 'completed', 'done'];
    return !closedStatuses.some(closedStatus => status.includes(closedStatus));
  }

  getClosedYesterday(tickets) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return tickets.filter(ticket => {
      const status = (ticket.Current_Status || '').toLowerCase();
      const closedStatuses = ['closed', 'resolved', 'completed', 'done'];
      const isClosed = closedStatuses.some(closedStatus => status.includes(closedStatus));
      
      // This is simplified - in real implementation you'd check actual close date
      return isClosed;
    });
  }


  isCreatedToday(ticket) {
    if (!ticket.IssueDate) return false;
    
    const today = new Date();
    const ticketDate = new Date(ticket.IssueDate);
    
    return ticketDate.toDateString() === today.toDateString();
  }

  isHighPriority(ticket) {
    const priority = (ticket.Priority || '').toLowerCase();
    return priority.includes('high') || priority.includes('critical') || priority.includes('urgent');
  }

  getLastTechResponse(ticket) {
    // Parse comments to find last TECH response (not user responses)
    if (!ticket.comments || ticket.comments.trim() === '') {
      return null;
    }
    
    const comments = ticket.comments;
    let lastTechResponse = null;
    
    // Look for patterns that indicate tech responses vs user responses
    // Tech responses typically include timestamps with tech names
    const techPatterns = [
      /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*(?!.*(?:any updates|please update|status update|checking on|follow up|following up))/i,
      /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*(?:BHOPB\\|bhopb\\)/i,  // Tech domain responses
      /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*[^:]*(?:resolved|completed|fixed|installed|configured|updated|tested|deployed)/i
    ];
    
    // Look for user response patterns that should NOT count as tech responses
    const userPatterns = [
      /any updates/i,
      /please update/i,
      /status update/i,
      /checking on/i,
      /follow up/i,
      /following up/i,
      /is this complete/i,
      /still working/i
    ];
    
    // Split comments by lines and check each one
    const lines = comments.split('\n');
    
    for (const line of lines) {
      // Skip if it's clearly a user asking for updates
      if (userPatterns.some(pattern => pattern.test(line))) {
        continue;
      }
      
      // Look for tech response patterns
      for (const pattern of techPatterns) {
        const match = pattern.exec(line);
        if (match) {
          try {
            const dateStr = match[1];
            const responseDate = new Date(dateStr);
            
            if (!isNaN(responseDate.getTime())) {
              if (!lastTechResponse || responseDate > lastTechResponse.date) {
                lastTechResponse = {
                  date: responseDate,
                  content: line.trim()
                };
              }
            }
          } catch (error) {
            // Skip malformed dates
            continue;
          }
        }
      }
    }
    
    // If no clear tech response found, check if comments suggest tech activity
    if (!lastTechResponse) {
      // Look for any evidence of tech work (not just user inquiries)
      const hasTechActivity = /(?:resolved|completed|fixed|installed|configured|updated|tested|deployed|working on|investigating|troubleshooting|bhopb\\|BHOPB\\)/i.test(comments);
      
      if (!hasTechActivity) {
        return null; // No tech response found
      }
    }
    
    return lastTechResponse;
  }

  hasUserNonResponsePattern(ticket) {
    // Simple implementation - check if ticket is in waiting status for a while
    const status = (ticket.Current_Status || '').toLowerCase();
    const age = this.businessDays.getBusinessDaysSince(ticket.IssueDate);
    
    return status.includes('waiting') || status.includes('awaiting') && age > 7;
  }

  isComplexProject(ticket) {
    const subject = (ticket.Subject || '').toLowerCase();
    const body = (ticket.Ticket_Body || '').toLowerCase();
    
    const complexKeywords = ['upgrade', 'migration', 'implementation', 'project', 'rollout', 'deployment'];
    return complexKeywords.some(keyword => 
      subject.includes(keyword) || body.includes(keyword)
    );
  }

  calculateUrgencyLevel(ticket, daysSinceCreated) {
    let urgency = daysSinceCreated * 10; // Base urgency on age
    
    if (this.isHighPriority(ticket)) {
      urgency *= 2; // Double urgency for high priority
    }
    
    return Math.min(urgency, 100); // Cap at 100
  }

  getNoResponseRecommendation(ticket, daysSinceCreated) {
    if (daysSinceCreated >= 7) {
      return 'Immediate technician assignment required';
    } else if (daysSinceCreated >= 5) {
      return 'Follow up with assigned technician';
    } else {
      return 'Monitor for next 24 hours';
    }
  }

  countTechResponses(ticket) {
    // Simple implementation - count based on comments
    if (!ticket.comments) return 0;
    
    // Count occurrences of "Technician" in comments as a simple proxy
    const matches = (ticket.comments || '').match(/technician/gi);
    return matches ? matches.length : 0;
  }

  countUserResponses(ticket) {
    // Simple implementation - count based on comments
    if (!ticket.comments) return 0;
    
    // Count lines that don't contain "Technician" as user responses
    const lines = ticket.comments.split('\n');
    return lines.filter(line => 
      line.trim() !== '' && !line.toLowerCase().includes('technician')
    ).length;
  }

  getLastActivityDate(ticket) {
    // Simple implementation - use issue date as placeholder
    return ticket.IssueDate;
  }

  generateActionPlan(recommendation, ticket) {
    const actions = [];
    
    switch(recommendation) {
      case 'close_no_user_response':
        actions.push('Send final follow-up email to user');
        actions.push('Close ticket if no response within 48 hours');
        break;
      case 'move_to_project_management':
        actions.push('Escalate to project management team');
        actions.push('Create project timeline and scope document');
        break;
      case 'push_to_closure':
        actions.push('Schedule resolution meeting with technician');
        actions.push('Set firm closure deadline');
        break;
      case 'escalate_management':
        actions.push('Manager review required');
        actions.push('Assess if additional resources needed');
        break;
      default:
        actions.push('Continue monitoring');
    }
    
    return actions;
  }

  assessResponseQuality(responses) {
    // Simple quality assessment - in real system would use AI
    if (!responses || responses.length === 0) return 0;
    
    // Basic scoring based on response length and frequency
    const avgLength = responses.reduce((sum, r) => sum + (r.content?.length || 0), 0) / responses.length;
    
    if (avgLength > 100) return 0.8; // Good detailed responses
    if (avgLength > 50) return 0.6;  // Adequate responses  
    if (avgLength > 20) return 0.4;  // Brief responses
    return 0.2; // Very brief responses
  }

  analyzeTicketResolution(ticket) {
    const age = this.businessDays.getBusinessDaysSince(ticket.IssueDate);
    const techResponses = this.countTechResponses(ticket);
    
    let qualityScore = 70; // Base score
    
    // Faster resolution = higher quality
    if (age <= 1) qualityScore += 20;
    else if (age <= 3) qualityScore += 10;
    else if (age >= 14) qualityScore -= 20;
    
    // More tech engagement = higher quality  
    if (techResponses >= 3) qualityScore += 10;
    else if (techResponses === 0) qualityScore -= 30;
    
    return {
      qualityScore: Math.max(0, Math.min(100, qualityScore)),
      resolutionTime: age,
      engagementLevel: techResponses > 2 ? 'high' : techResponses > 0 ? 'medium' : 'low'
    };
  }

  // More helper methods...
}

module.exports = DailyIntelligenceEngine;