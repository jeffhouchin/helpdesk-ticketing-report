// Ticket SLA Policy - Business Hours Calculator
// Defines SLA requirements and calculates compliance

class TicketSLAPolicy {
  constructor() {
    this.businessHours = {
      weekday: { start: 8.5, end: 17.5 }, // 8:30 AM to 5:30 PM
      weekend: { start: 8.5, end: 16 }    // 8:30 AM to 4:00 PM
    };
    
    this.slaRules = {
      assignment: 1,        // 1 business hour to assign
      firstResponse: 2,     // 2 business hours after assigned for tech response
      userFollowUp: 16,     // 2 days (16 business hours) for tech to respond after user response
      techFollowUp: 24,     // 3 days (24 business hours) for response after tech response with no user response
      resolution: {
        critical: 8,   // 8 business hours (1 day)
        high: 16,      // 16 business hours (2 days)
        normal: 24,    // 24 business hours (3 days)
        low: 40        // 40 business hours (5 days)
      }
    };
  }

  /**
   * Convert date to EST/EDT
   * @param {Date} date 
   * @returns {Date} Date in EST/EDT
   */
  toEasternTime(date) {
    // Create date string in Eastern Time
    const easternTime = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return easternTime;
  }

  /**
   * Calculate business hours between two dates in EST/EDT
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {number} Business hours elapsed
   */
  getBusinessHoursBetween(startDate, endDate) {
    if (startDate >= endDate) return 0;
    
    // Convert to Eastern Time
    const estStart = this.toEasternTime(startDate);
    const estEnd = this.toEasternTime(endDate);
    
    let totalHours = 0;
    let currentDate = new Date(estStart);
    currentDate.setHours(0, 0, 0, 0); // Start at beginning of day
    
    while (currentDate <= estEnd) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const hours = isWeekend ? this.businessHours.weekend : this.businessHours.weekday;
      
      // Create business hours for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(Math.floor(hours.start), (hours.start % 1) * 60, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(Math.floor(hours.end), (hours.end % 1) * 60, 0, 0);
      
      // Calculate overlap between business hours and our time range
      const rangeStart = estStart > dayStart ? estStart : dayStart;
      const rangeEnd = estEnd < dayEnd ? estEnd : dayEnd;
      
      // If there's an overlap, add those hours
      if (rangeStart < rangeEnd) {
        const hoursThisDay = (rangeEnd - rangeStart) / (1000 * 60 * 60);
        totalHours += hoursThisDay;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Return actual business hours without artificial cap
    return totalHours;
  }

  /**
   * Check if ticket assignment violates SLA
   * @param {Date} createdDate 
   * @param {Date} assignedDate 
   * @returns {object} SLA status
   */
  checkAssignmentSLA(createdDate, assignedDate) {
    const slaLimit = this.slaRules.assignment; // 1 business hour for all priorities
    
    if (!assignedDate) {
      const now = new Date();
      const hoursElapsed = this.getBusinessHoursBetween(createdDate, now);
      
      return {
        status: hoursElapsed > slaLimit ? 'VIOLATED' : 'AT_RISK',
        hoursElapsed,
        slaLimit,
        hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
        message: `Unassigned for ${hoursElapsed.toFixed(1)} hours (SLA: ${slaLimit} hour)`
      };
    }
    
    const hoursToAssign = this.getBusinessHoursBetween(createdDate, assignedDate);
    
    return {
      status: hoursToAssign <= slaLimit ? 'COMPLIANT' : 'VIOLATED',
      hoursElapsed: hoursToAssign,
      slaLimit,
      hoursOverdue: Math.max(0, hoursToAssign - slaLimit),
      message: `Assigned in ${hoursToAssign.toFixed(1)} hours (SLA: ${slaLimit} hour)`
    };
  }

  /**
   * Check first response SLA (after assignment)
   * @param {Date} assignedDate 
   * @param {Date} firstResponseDate 
   * @returns {object} SLA status
   */
  checkFirstResponseSLA(assignedDate, firstResponseDate) {
    const slaLimit = this.slaRules.firstResponse; // 2 business hours after assignment
    
    if (!assignedDate) {
      // Can't check first response SLA without assignment date
      return {
        status: 'UNKNOWN',
        message: 'Cannot calculate first response SLA without assignment date'
      };
    }
    
    if (!firstResponseDate) {
      const now = new Date();
      const hoursElapsed = this.getBusinessHoursBetween(assignedDate, now);
      
      return {
        status: hoursElapsed > slaLimit ? 'VIOLATED' : hoursElapsed > (slaLimit * 0.75) ? 'AT_RISK' : 'PENDING',
        hoursElapsed,
        slaLimit,
        hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
        message: `No response for ${hoursElapsed.toFixed(1)} hours since assignment (SLA: ${slaLimit} hours)`
      };
    }
    
    const hoursToResponse = this.getBusinessHoursBetween(assignedDate, firstResponseDate);
    
    return {
      status: hoursToResponse <= slaLimit ? 'COMPLIANT' : 'VIOLATED',
      hoursElapsed: hoursToResponse,
      slaLimit,
      hoursOverdue: Math.max(0, hoursToResponse - slaLimit),
      message: `First response in ${hoursToResponse.toFixed(1)} hours after assignment (SLA: ${slaLimit} hours)`
    };
  }

  /**
   * Check follow-up response SLA
   * @param {Date} lastUserResponseDate 
   * @param {Date} lastTechResponseDate 
   * @param {boolean} hasUserResponse - Did user respond after last tech response?
   * @returns {object} SLA status
   */
  checkFollowUpSLA(lastUserResponseDate, lastTechResponseDate, hasUserResponse = false) {
    const now = new Date();
    const slaLimit = hasUserResponse ? this.slaRules.userFollowUp : this.slaRules.techFollowUp;
    const referenceDate = hasUserResponse ? lastUserResponseDate : lastTechResponseDate;
    
    if (!referenceDate) return null;
    
    const hoursElapsed = this.getBusinessHoursBetween(referenceDate, now);
    
    return {
      status: hoursElapsed > slaLimit ? 'VIOLATED' : hoursElapsed > (slaLimit * 0.8) ? 'AT_RISK' : 'COMPLIANT',
      hoursElapsed,
      slaLimit,
      hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
      message: `${hoursElapsed.toFixed(1)} business hours since ${hasUserResponse ? 'user response' : 'tech response'} (SLA: ${slaLimit} hours)`,
      type: hasUserResponse ? 'AFTER_USER' : 'NO_USER_RESPONSE'
    };
  }

  /**
   * Get comprehensive SLA analysis for a ticket
   * @param {object} ticket 
   * @returns {object} Complete SLA analysis
   */
  analyzeSLA(ticket) {
    const createdDate = new Date(ticket.IssueDate);
    const assignedDate = (ticket.Tech_Assigned_Clean || ticket.Tech_Email) ? this.estimateAssignmentDate(ticket) : null;
    const firstResponseDate = this.getFirstTechResponseDate(ticket);
    const { lastUserResponse, lastTechResponse, hasUserResponseAfterTech } = this.parseResponseHistory(ticket);
    
    return {
      ticketId: ticket.IssueID,
      created: createdDate,
      assignment: this.checkAssignmentSLA(createdDate, assignedDate),
      firstResponse: this.checkFirstResponseSLA(assignedDate, firstResponseDate),
      followUp: this.checkFollowUpSLA(lastUserResponse, lastTechResponse, hasUserResponseAfterTech),
      overallRisk: this.calculateOverallRisk(ticket),
      recommendedAction: this.getRecommendedAction(ticket)
    };
  }

  /**
   * Estimate assignment date from comments (fallback logic)
   */
  estimateAssignmentDate(ticket) {
    // Parse comments to find when assignment happened
    if (!ticket.comments) return null;
    
    // Look for assignment patterns in comments
    // Pattern: "MM/DD/YYYY HH:MM : ... : The ticket has been assigned to technician: [name]"
    const assignmentPattern = /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:.*?(?:ticket has been assigned to|assigned to technician|assigned:|reassigned to)/i;
    
    const match = ticket.comments.match(assignmentPattern);
    if (match) {
      try {
        const assignedDate = new Date(match[1]);
        if (!isNaN(assignedDate.getTime())) {
          return assignedDate;
        }
      } catch (error) {
        console.log(`Failed to parse assignment date from: ${match[1]}`);
      }
    }
    
    // If we have a tech assigned but can't find assignment date in comments,
    // assume it was assigned shortly after creation (within 1 hour for SLA purposes)
    if (ticket.Tech_Assigned_Clean || ticket.Tech_Email) {
      const createdDate = new Date(ticket.IssueDate);
      const estimatedAssignmentDate = new Date(createdDate.getTime() + (30 * 60 * 1000)); // 30 minutes after creation
      return estimatedAssignmentDate;
    }
    
    return null;
  }

  /**
   * Find first technical response in comments
   */
  getFirstTechResponseDate(ticket) {
    if (!ticket.comments) return null;
    
    // Look for all technician responses (BHOPB\username or bhopb\username patterns)
    // Updated pattern to match all occurrences with global flag
    const techResponsePattern = /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*(?:BHOPB\\[^:]+|bhopb\\[^:]+)\s*:\s*Technician/gi;
    
    let earliestResponse = null;
    let match;
    
    // Find all matches and get the earliest one
    while ((match = techResponsePattern.exec(ticket.comments)) !== null) {
      try {
        const responseDate = new Date(match[1]);
        if (!isNaN(responseDate.getTime())) {
          // Skip if this is just an assignment message
          const contextAfterDate = ticket.comments.substring(match.index, match.index + 200);
          if (contextAfterDate.includes('ticket has been assigned') || 
              contextAfterDate.includes('assigned to technician')) {
            continue; // Skip assignment messages
          }
          
          if (!earliestResponse || responseDate < earliestResponse) {
            earliestResponse = responseDate;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return earliestResponse;
  }

  /**
   * Parse response history to determine follow-up SLA requirements
   */
  parseResponseHistory(ticket) {
    // Complex parsing logic would go here
    // For now, return basic structure
    return {
      lastUserResponse: null,
      lastTechResponse: null,
      hasUserResponseAfterTech: false
    };
  }

  /**
   * Calculate overall risk level for the ticket
   */
  calculateOverallRisk(ticket) {
    const age = (new Date() - new Date(ticket.IssueDate)) / (1000 * 60 * 60 * 24);
    
    if (age > 21) return 'CRITICAL';
    if (age > 14) return 'HIGH';
    if (age > 7) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get recommended action based on SLA analysis
   */
  getRecommendedAction(ticket) {
    if (!ticket.Tech_Assigned_Clean) return 'ASSIGN_IMMEDIATELY';
    
    const age = (new Date() - new Date(ticket.IssueDate)) / (1000 * 60 * 60 * 24);
    
    if (age > 21) return 'ESCALATE_TO_MANAGER';
    if (age > 14) return 'SENIOR_TECH_REVIEW';
    if (age > 7) return 'FOLLOW_UP_REQUIRED';
    
    return 'MONITOR';
  }

  /**
   * Get priority level from priority string
   * @param {string} priority - Priority string from ticket
   * @returns {string} normalized priority level
   */
  getPriorityLevel(priority) {
    if (!priority) return 'normal';
    
    const p = priority.toLowerCase();
    if (p.includes('critical') || p.includes('urgent')) return 'critical';
    if (p.includes('high')) return 'high';
    if (p.includes('low')) return 'low';
    return 'normal';
  }
}

module.exports = TicketSLAPolicy;