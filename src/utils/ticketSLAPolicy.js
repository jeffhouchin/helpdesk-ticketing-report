// Ticket SLA Policy - Business Hours Calculator
// Defines SLA requirements and calculates compliance

class TicketSLAPolicy {
  constructor() {
    this.businessHours = {
      weekday: { start: 8, end: 17.5 }, // 8 AM to 5:30 PM
      weekend: { start: 8, end: 16 }    // 8 AM to 4:00 PM
    };
    
    this.slaRules = {
      assignment: {
        weekday: 1,  // 1 business hour
        weekend: 2   // 2 business hours
      },
      firstResponse: {
        weekday: 3,  // 3 business hours
        weekend: 3   // 3 business hours
      },
      followUpAfterUser: 48,      // 48 hours after user response
      followUpNoUser: 72          // 72 hours (3 business days) if no user response
    };
  }

  /**
   * Calculate business hours between two dates
   * @param {Date} startDate 
   * @param {Date} endDate 
   * @returns {number} Business hours elapsed
   */
  getBusinessHoursBetween(startDate, endDate) {
    if (startDate >= endDate) return 0;
    
    let totalHours = 0;
    let currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const hours = isWeekend ? this.businessHours.weekend : this.businessHours.weekday;
      
      const dayStart = new Date(currentDate);
      dayStart.setHours(hours.start, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(Math.floor(hours.end), (hours.end % 1) * 60, 0, 0);
      
      // If both times are within this day's business hours
      if (startDate <= dayEnd && endDate >= dayStart) {
        const effectiveStart = startDate > dayStart ? startDate : dayStart;
        const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;
        
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
   * @returns {object} SLA status
   */
  checkAssignmentSLA(createdDate, assignedDate) {
    if (!assignedDate) {
      const now = new Date();
      const hoursElapsed = this.getBusinessHoursBetween(createdDate, now);
      const dayOfWeek = createdDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const slaLimit = this.slaRules.assignment[isWeekend ? 'weekend' : 'weekday'];
      
      return {
        status: hoursElapsed > slaLimit ? 'VIOLATED' : 'AT_RISK',
        hoursElapsed,
        slaLimit,
        hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
        message: `Unassigned for ${hoursElapsed.toFixed(1)} hours (SLA: ${slaLimit} hours)`
      };
    }
    
    const hoursToAssign = this.getBusinessHoursBetween(createdDate, assignedDate);
    const dayOfWeek = createdDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const slaLimit = this.slaRules.assignment[isWeekend ? 'weekend' : 'weekday'];
    
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
   * @returns {object} SLA status
   */
  checkFirstResponseSLA(createdDate, firstResponseDate) {
    if (!firstResponseDate) {
      const now = new Date();
      const hoursElapsed = this.getBusinessHoursBetween(createdDate, now);
      const slaLimit = this.slaRules.firstResponse.weekday; // Same for weekday/weekend
      
      return {
        status: hoursElapsed > slaLimit ? 'VIOLATED' : 'AT_RISK',
        hoursElapsed,
        slaLimit,
        hoursOverdue: Math.max(0, hoursElapsed - slaLimit),
        message: `No response for ${hoursElapsed.toFixed(1)} hours (SLA: ${slaLimit} hours)`
      };
    }
    
    const hoursToResponse = this.getBusinessHoursBetween(createdDate, firstResponseDate);
    const slaLimit = this.slaRules.firstResponse.weekday;
    
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
    
    return {
      ticketId: ticket.IssueID,
      created: createdDate,
      assignment: this.checkAssignmentSLA(createdDate, assignedDate),
      firstResponse: this.checkFirstResponseSLA(createdDate, firstResponseDate),
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
}

module.exports = TicketSLAPolicy;