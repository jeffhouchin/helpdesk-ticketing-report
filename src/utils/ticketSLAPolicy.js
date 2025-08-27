// Ticket SLA Policy - Business Hours Calculator
// Defines SLA requirements and calculates compliance

class TicketSLAPolicy {
  constructor() {
    this.businessHours = {
      weekday: { start: 8.5, end: 17.5 }, // 8:30 AM to 5:30 PM
      weekend: { start: 8.5, end: 16 }    // 8:30 AM to 4:00 PM
    };
    
    this.slaRules = {
      assignment: {
        critical: 1,   // 1 business hour
        high: 2,       // 2 business hours
        normal: 4,     // 4 business hours
        low: 8         // 8 business hours
      },
      firstResponse: {
        critical: 1,   // 1 business hour
        high: 2,       // 2 business hours
        normal: 4,     // 4 business hours
        low: 8         // 8 business hours
      },
      userFollowUp: 4,             // 4 business hours after user responds
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
    
    while (currentDate < estEnd) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const hours = isWeekend ? this.businessHours.weekend : this.businessHours.weekday;
      
      const dayStart = new Date(currentDate);
      dayStart.setHours(Math.floor(hours.start), (hours.start % 1) * 60, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(Math.floor(hours.end), (hours.end % 1) * 60, 0, 0);
      
      // If both times are within this day's business hours
      if (estStart <= dayEnd && estEnd >= dayStart) {
        const effectiveStart = estStart > dayStart ? estStart : dayStart;
        const effectiveEnd = estEnd < dayEnd ? estEnd : dayEnd;
        
        if (effectiveStart < effectiveEnd) {
          totalHours += (effectiveEnd - effectiveStart) / (1000 * 60 * 60);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }
    
    return totalHours;
  }

  /**
   * Check if ticket assignment violates SLA
   * @param {Date} createdDate 
   * @param {Date} assignedDate 
   * @param {string} priority - Ticket priority (Critical, High, Normal, Low)
   * @returns {object} SLA status
   */
  checkAssignmentSLA(createdDate, assignedDate, priority = 'normal') {
    const priorityLevel = this.getPriorityLevel(priority);
    const slaLimit = this.slaRules.assignment[priorityLevel];
    
    if (!assignedDate) {
      const now = new Date();
      const hoursElapsed = this.getBusinessHoursBetween(createdDate, now);
      
      return {
        status: hoursElapsed > slaLimit ? 'VIOLATED' : 'AT_RISK',
        hoursElapsed,
        slaLimit,
        hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
        message: `Unassigned for ${hoursElapsed.toFixed(1)} hours (SLA: ${slaLimit} hours)`
      };
    }
    
    const hoursToAssign = this.getBusinessHoursBetween(createdDate, assignedDate);
    
    return {
      status: hoursToAssign <= slaLimit ? 'COMPLIANT' : 'VIOLATED',
      hoursElapsed: hoursToAssign,
      slaLimit,
      hoursOverdue: Math.max(0, hoursToAssign - slaLimit),
      message: `Assigned in ${hoursToAssign.toFixed(1)} hours (SLA: ${slaLimit} hours)`
    };
  }

  /**
   * Check first response SLA
   * @param {Date} createdDate 
   * @param {Date} firstResponseDate 
   * @param {string} priority - Ticket priority (Critical, High, Normal, Low)
   * @returns {object} SLA status
   */
  checkFirstResponseSLA(createdDate, firstResponseDate, priority = 'normal') {
    const priorityLevel = this.getPriorityLevel(priority);
    const slaLimit = this.slaRules.firstResponse[priorityLevel];
    
    if (!firstResponseDate) {
      const now = new Date();
      const hoursElapsed = this.getBusinessHoursBetween(createdDate, now);
      
      return {
        status: hoursElapsed > slaLimit ? 'VIOLATED' : 'AT_RISK',
        hoursElapsed,
        slaLimit,
        hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
        message: `No response for ${hoursElapsed.toFixed(1)} hours (SLA: ${slaLimit} hours)`
      };
    }
    
    const hoursToResponse = this.getBusinessHoursBetween(createdDate, firstResponseDate);
    
    return {
      status: hoursToResponse <= slaLimit ? 'COMPLIANT' : 'VIOLATED',
      hoursElapsed: hoursToResponse,
      slaLimit,
      hoursOverdue: Math.max(0, hoursToResponse - slaLimit),
      message: `First response in ${hoursToResponse.toFixed(1)} hours (SLA: ${slaLimit} hours)`
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
    const slaLimit = hasUserResponse ? this.slaRules.followUpAfterUser : this.slaRules.followUpNoUser;
    const referenceDate = hasUserResponse ? lastUserResponseDate : lastTechResponseDate;
    
    if (!referenceDate) return null;
    
    const hoursElapsed = (now - referenceDate) / (1000 * 60 * 60);
    
    return {
      status: hoursElapsed > slaLimit ? 'VIOLATED' : hoursElapsed > (slaLimit * 0.8) ? 'AT_RISK' : 'COMPLIANT',
      hoursElapsed,
      slaLimit,
      hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
      message: `${hoursElapsed.toFixed(1)} hours since ${hasUserResponse ? 'user response' : 'tech response'} (SLA: ${slaLimit} hours)`,
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
    const assignedDate = ticket.Tech_Assigned_Clean ? this.estimateAssignmentDate(ticket) : null;
    const firstResponseDate = this.getFirstTechResponseDate(ticket);
    const { lastUserResponse, lastTechResponse, hasUserResponseAfterTech } = this.parseResponseHistory(ticket);
    const priority = ticket.Priority || 'Normal';
    
    return {
      ticketId: ticket.IssueID,
      created: createdDate,
      assignment: this.checkAssignmentSLA(createdDate, assignedDate, priority),
      firstResponse: this.checkFirstResponseSLA(createdDate, firstResponseDate, priority),
      followUp: this.checkFollowUpSLA(lastUserResponse, lastTechResponse, hasUserResponseAfterTech),
      overallRisk: this.calculateOverallRisk(ticket),
      recommendedAction: this.getRecommendedAction(ticket)
    };
  }

  /**
   * Estimate assignment date from comments (fallback logic)
   */
  estimateAssignmentDate(ticket) {
    // This would need to parse comments to find when assignment happened
    // For now, return null to indicate we need assignment tracking
    return null;
  }

  /**
   * Find first technical response in comments
   */
  getFirstTechResponseDate(ticket) {
    if (!ticket.comments) return null;
    
    const techPatterns = [
      /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*(?:BHOPB\\|bhopb\\)/i,
      /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2})\s*:\s*[^:]*(?:resolved|completed|fixed|working|investigating)/i
    ];
    
    let earliestResponse = null;
    
    for (const pattern of techPatterns) {
      const matches = ticket.comments.match(pattern);
      if (matches) {
        try {
          const responseDate = new Date(matches[1]);
          if (!isNaN(responseDate.getTime()) && (!earliestResponse || responseDate < earliestResponse)) {
            earliestResponse = responseDate;
          }
        } catch (error) {
          continue;
        }
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