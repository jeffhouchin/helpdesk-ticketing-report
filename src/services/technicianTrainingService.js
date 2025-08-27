// Technician Training Service - Randomly reviews tickets and sends training feedback to technicians
const SmartAIService = require('./smartAIService');
const gradingRules = require('../config/gradingRules.json');
const fs = require('fs').promises;
const path = require('path');

class TechnicianTrainingService {
  constructor() {
    this.aiService = new SmartAIService();
    this.rules = gradingRules;
    this.historyFile = path.join(__dirname, '../../data/grading_history.json');
  }

  async selectRandomTicketForReview(ticketData) {
    console.log('🎲 Selecting random ticket for review...');
    
    const now = new Date();
    const seventyTwoHoursAgo = new Date(now.getTime() - (72 * 60 * 60 * 1000));
    
    // Only review tickets that are at least 72 hours old and have been worked on
    const eligibleTickets = ticketData.openTickets.filter(ticket => {
      const ticketDate = new Date(ticket.IssueDate);
      const isOldEnough = ticketDate <= seventyTwoHoursAgo;
      const hasBeenWorked = ticket.Tech_Assigned_Clean && 
                           ticket.comments && 
                           ticket.comments.length > 0;
      
      return isOldEnough && hasBeenWorked;
    });
    
    console.log(`Found ${eligibleTickets.length} tickets older than 72 hours with activity`);
    
    if (eligibleTickets.length === 0) {
      console.log('No eligible tickets for review (must be 72+ hours old with activity)');
      return null;
    }
    
    // Random selection
    const randomIndex = Math.floor(Math.random() * eligibleTickets.length);
    const selectedTicket = eligibleTickets[randomIndex];
    
    const ticketAge = Math.floor((now - new Date(selectedTicket.IssueDate)) / (1000 * 60 * 60));
    console.log(`Selected ticket #${selectedTicket.IssueID} (${ticketAge} hours old) - Status: ${selectedTicket.Current_Status}`);
    return selectedTicket;
  }
  
  extractAllTechnicians(ticket) {
    const technicians = new Set();
    
    // Add currently assigned tech
    if (ticket.Tech_Assigned_Clean) {
      technicians.add(ticket.Tech_Assigned_Clean);
    }
    
    // Parse comments to find all techs who have worked on the ticket
    if (ticket.comments) {
      // Pattern to match technician actions in comments
      // e.g., "08/24/2025 14:34 : bhopb\kpunch : Technician :"
      const techPattern = /:\s*([^:]+)\s*:\s*Technician\s*:/gi;
      let match;
      
      while ((match = techPattern.exec(ticket.comments)) !== null) {
        const techName = match[1].trim();
        if (techName && techName !== '') {
          technicians.add(techName);
        }
      }
      
      // Also look for assignment/reassignment patterns
      const assignPattern = /assigned to technician:\s*([^\\n]+)/gi;
      while ((match = assignPattern.exec(ticket.comments)) !== null) {
        const techName = match[1].trim();
        if (techName && techName !== '') {
          technicians.add(techName);
        }
      }
    }
    
    return Array.from(technicians);
  }

  async gradeTicketForTraining(ticket) {
    console.log(`📝 Grading ticket #${ticket.IssueID} for training purposes...`);
    
    // Get all technicians involved
    const allTechnicians = this.extractAllTechnicians(ticket);
    
    const gradeDetails = {
      ticketId: ticket.IssueID,
      technician: ticket.Tech_Assigned_Clean, // Primary assigned
      allTechnicians: allTechnicians, // All involved
      ticketStatus: ticket.Current_Status,
      ticketAge: this.calculateAge(ticket.IssueDate),
      priority: this.getPriorityLevel(ticket.Priority),
      gradedAt: new Date().toISOString(),
      scores: {},
      feedback: [],
      strengths: [],
      improvements: [],
      totalScore: 0,
      grade: 'F'
    };
    
    // Evaluate response time
    const responseScore = this.evaluateResponseTime(ticket);
    gradeDetails.scores.responseTime = responseScore;
    
    // Evaluate communication quality using AI
    const communicationScore = await this.evaluateCommunication(ticket);
    gradeDetails.scores.communication = communicationScore;
    
    // Evaluate technical resolution
    const resolutionScore = this.evaluateTechnicalResolution(ticket);
    gradeDetails.scores.resolution = resolutionScore;
    
    // Evaluate customer service
    const serviceScore = this.evaluateCustomerService(ticket);
    gradeDetails.scores.customerService = serviceScore;
    
    // Evaluate efficiency
    const efficiencyScore = this.evaluateEfficiency(ticket);
    gradeDetails.scores.efficiency = efficiencyScore;
    
    // Evaluate status appropriateness
    const statusScore = this.evaluateStatusAppropriateness(ticket);
    gradeDetails.scores.statusManagement = statusScore;
    
    // Calculate total score (now out of 110 with status management)
    const rawScore = responseScore.score + 
                    communicationScore.score + 
                    resolutionScore.score + 
                    serviceScore.score + 
                    efficiencyScore.score +
                    statusScore.score;
    
    // Normalize to 100
    gradeDetails.totalScore = Math.round((rawScore / 110) * 100);
    
    // Determine grade
    if (gradeDetails.totalScore >= 90) gradeDetails.grade = 'A';
    else if (gradeDetails.totalScore >= 80) gradeDetails.grade = 'B';
    else if (gradeDetails.totalScore >= 70) gradeDetails.grade = 'C';
    else if (gradeDetails.totalScore >= 60) gradeDetails.grade = 'D';
    else gradeDetails.grade = 'F';
    
    // Compile feedback
    this.compileFeedback(gradeDetails);
    
    // Store in history
    await this.storeGradingHistory(gradeDetails);
    
    return gradeDetails;
  }

  evaluateResponseTime(ticket) {
    const created = new Date(ticket.IssueDate);
    const now = new Date();
    const businessHoursToFirstResponse = this.findFirstResponseTimeBusinessHours(ticket, created);
    
    const criteria = this.rules.grading_criteria.response_time;
    let score = 0;
    let feedback = '';
    
    // Use business hours thresholds
    for (const level of Object.keys(criteria.thresholds)) {
      const threshold = criteria.thresholds[level];
      if (businessHoursToFirstResponse <= threshold.business_hours) {
        score = threshold.points;
        feedback = threshold.feedback;
        break;
      }
    }
    
    // Check against SLA based on priority
    const priority = this.getPriorityLevel(ticket.Priority).toLowerCase();
    const slaHours = this.rules.sla_requirements.first_response[priority] || 
                     this.rules.sla_requirements.first_response.normal;
    
    if (businessHoursToFirstResponse > slaHours) {
      feedback += ` (SLA VIOLATED: ${slaHours} business hour requirement)`;
      score = Math.min(score, 10); // Cap score if SLA violated
    }
    
    return {
      score,
      feedback,
      actualBusinessHours: businessHoursToFirstResponse,
      slaHours,
      weight: criteria.weight
    };
  }

  findFirstResponseTimeBusinessHours(ticket, created) {
    // Use the SLA Policy calculator for business hours
    const TicketSLAPolicy = require('../utils/ticketSLAPolicy');
    const slaPolicy = new TicketSLAPolicy();
    
    if (!ticket.comments || ticket.comments.length === 0) {
      // No response - calculate business hours from creation to now
      return slaPolicy.getBusinessHoursBetween(created, new Date());
    }
    
    // Parse comments to find first tech response timestamp
    // Look for patterns like "08/24/2025 14:34 : bhopb\kpunch : Technician :"
    const comments = ticket.comments;
    const techResponsePattern = /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}).*?:\s*Technician\s*:/i;
    const match = comments.match(techResponsePattern);
    
    if (match && match[1]) {
      // Parse the timestamp (MM/DD/YYYY HH:MM format)
      const responseTime = new Date(match[1]);
      if (!isNaN(responseTime)) {
        return slaPolicy.getBusinessHoursBetween(created, responseTime);
      }
    }
    
    // Fallback: Look for status change to "In progress" timestamp
    if (ticket.StartDate) {
      const startDate = new Date(ticket.StartDate);
      if (!isNaN(startDate)) {
        return slaPolicy.getBusinessHoursBetween(created, startDate);
      }
    }
    
    // No clear response found - return current elapsed business hours
    return slaPolicy.getBusinessHoursBetween(created, new Date());
  }
  
  findFirstResponseTime(ticket, created) {
    // Deprecated - use findFirstResponseTimeBusinessHours instead
    return this.findFirstResponseTimeBusinessHours(ticket, created);
  }

  async evaluateCommunication(ticket) {
    const criteria = this.rules.grading_criteria.communication_quality;
    
    try {
      // Use AI to evaluate communication quality
      const prompt = `Evaluate the communication quality in this helpdesk ticket. 
      Score each aspect from 0-4 points (total 20 points possible):
      - Greeting/acknowledgment (0-4)
      - Professional tone (0-4)
      - Clear next steps (0-4)
      - Empathy shown (0-4)
      - Solution explained clearly (0-4)
      
      Ticket content:
      Subject: ${ticket.Subject}
      Body: ${ticket.Ticket_Body?.substring(0, 500)}
      Tech responses: ${ticket.comments?.substring(0, 1000)}
      
      Return JSON: {"greeting": X, "tone": X, "nextSteps": X, "empathy": X, "clarity": X, "total": X, "feedback": "..."}`;
      
      const aiResponse = await this.aiService.analyzeWithCheapModel(prompt);
      const evaluation = JSON.parse(aiResponse);
      
      return {
        score: evaluation.total,
        feedback: evaluation.feedback,
        weight: criteria.weight,
        details: evaluation
      };
      
    } catch (error) {
      console.log('AI evaluation failed, using fallback scoring');
      return {
        score: 10, // Middle score as fallback
        feedback: 'Communication assessment pending manual review',
        weight: criteria.weight
      };
    }
  }

  evaluateTechnicalResolution(ticket) {
    const criteria = this.rules.grading_criteria.technical_resolution;
    let score = 0;
    const feedback = [];
    
    const comments = (ticket.comments || '').toLowerCase();
    const status = ticket.Current_Status;
    
    // Check if problem was identified
    if (comments.includes('issue') || comments.includes('problem') || 
        comments.includes('cause')) {
      score += criteria.aspects.problem_identified.points;
      feedback.push(criteria.aspects.problem_identified.feedback);
    }
    
    // Check if solution was provided
    if (comments.includes('fixed') || comments.includes('resolved') || 
        comments.includes('solution')) {
      score += criteria.aspects.solution_provided.points;
      feedback.push(criteria.aspects.solution_provided.feedback);
    }
    
    // Check for follow-up
    if (comments.includes('follow') || comments.includes('check back')) {
      score += criteria.aspects.follow_up_planned.points;
      feedback.push(criteria.aspects.follow_up_planned.feedback);
    }
    
    // Check documentation
    if (comments.length > 100) {
      score += criteria.aspects.documentation_complete.points;
      feedback.push(criteria.aspects.documentation_complete.feedback);
    }
    
    return {
      score,
      feedback: feedback.join('. '),
      weight: criteria.weight
    };
  }

  evaluateCustomerService(ticket) {
    const criteria = this.rules.grading_criteria.customer_service;
    const comments = (ticket.comments || '').toLowerCase();
    let score = 0;
    const positives = [];
    
    // Check for patience indicators
    if (!comments.includes('urgent') || comments.includes('no rush')) {
      score += 4;
      positives.push(criteria.evaluation_points.patience);
    }
    
    // Check for ownership
    if (comments.includes('i will') || comments.includes("i'll") || 
        comments.includes('my responsibility')) {
      score += 4;
      positives.push(criteria.evaluation_points.ownership);
    }
    
    // Check for proactive help
    if (comments.includes('also') || comments.includes('additionally') || 
        comments.includes('prevent')) {
      score += 4;
      positives.push(criteria.evaluation_points.proactive);
    }
    
    // Check for education
    if (comments.includes('future') || comments.includes('tip') || 
        comments.includes('avoid')) {
      score += 3;
      positives.push(criteria.evaluation_points.education);
    }
    
    return {
      score,
      feedback: positives.join(', '),
      weight: criteria.weight
    };
  }

  evaluateEfficiency(ticket) {
    const criteria = this.rules.grading_criteria.efficiency;
    const age = this.calculateAge(ticket.IssueDate);
    const status = ticket.Current_Status;
    
    let score = 0;
    let feedback = '';
    
    if (status === 'Resolved' && age <= 1) {
      score = criteria.metrics.single_touch_resolution.points;
      feedback = criteria.metrics.single_touch_resolution.feedback;
    } else if (age <= 3) {
      score = criteria.metrics.minimal_escalation.points;
      feedback = criteria.metrics.minimal_escalation.feedback;
    } else {
      score = criteria.metrics.appropriate_escalation.points;
      feedback = criteria.metrics.appropriate_escalation.feedback;
    }
    
    return {
      score,
      feedback,
      weight: criteria.weight
    };
  }
  
  evaluateStatusAppropriateness(ticket) {
    const status = (ticket.Current_Status || '').toLowerCase();
    const age = this.calculateAge(ticket.IssueDate);
    const businessHoursAge = this.getBusinessHoursAge(ticket.IssueDate);
    const comments = (ticket.comments || '').toLowerCase();
    
    let score = 10; // Default full score
    let feedback = 'Status appropriately managed';
    
    // Actual statuses in your system:
    // "New", "In progress", "Awaiting Customer Response", "Shipped-Pending Delivery", "Approved by Leadership"
    
    if (status === 'new') {
      // New tickets should be moved to appropriate status quickly
      if (businessHoursAge > 4) {
        score = 0;
        feedback = `Ticket still "New" after ${businessHoursAge.toFixed(1)} business hours - update status`;
      } else if (businessHoursAge > 2) {
        score = 5;
        feedback = 'Update from "New" to appropriate status after initial response';
      } else {
        score = 10;
        feedback = 'New ticket within acceptable timeframe';
      }
      
      // If tech has responded but status still "New", that's wrong
      if (comments.includes('technician') && comments.includes(':')) {
        score = Math.min(score, 3);
        feedback = 'Tech responded but status still "New" - update to appropriate status';
      }
      
    } else if (status === 'in progress') {
      // In progress should show actual progress
      if (age > 14) {
        const hasRecentTechActivity = this.checkRecentTechActivity(ticket);
        if (!hasRecentTechActivity) {
          score = 3;
          feedback = `"In progress" for ${age} days with no recent updates - review status`;
        } else {
          score = 8;
          feedback = 'Long-running ticket but showing activity';
        }
      } else {
        score = 10;
        feedback = 'Good - actively being worked';
      }
      
      // Check if should be "Awaiting Customer Response" instead
      if (comments.includes('waiting for') || comments.includes('awaiting') || 
          comments.includes('please confirm') || comments.includes('let me know')) {
        score = Math.min(score, 5);
        feedback = 'Waiting for customer - should be "Awaiting Customer Response" not "In progress"';
      }
      
    } else if (status.includes('awaiting customer')) {
      // This is perfect for tickets waiting on customer
      score = 10;
      feedback = 'Correctly marked as awaiting customer';
      
      // But check if we've been waiting too long
      if (age > 7) {
        feedback += ` - Consider follow-up (waiting ${age} days)`;
      }
      
    } else if (status.includes('shipped') || status.includes('pending delivery')) {
      // Good for hardware/equipment tickets
      score = 10;
      feedback = 'Appropriately marked for shipment tracking';
      
      // Check if shipment is taking too long
      if (age > 10) {
        score = 8;
        feedback = `Shipment pending for ${age} days - verify tracking and ETA`;
      }
      
    } else if (status.includes('approved')) {
      // Leadership approved status
      score = 10;
      feedback = 'Approved status - ensure next steps are clear';
      
      // Check if action taken after approval
      if (!comments.includes('approved') || age > 2) {
        score = 7;
        feedback = 'Approved but ensure follow-through on approved action';
      }
      
    } else if (status.includes('resolved') || status.includes('closed')) {
      // Should have customer confirmation
      if (comments.includes('confirmed') || comments.includes('working') || 
          comments.includes('thank') || comments.includes('fixed')) {
        score = 10;
        feedback = 'Properly closed with confirmation';
      } else {
        score = 7;
        feedback = 'Closed but verify customer confirmation';
      }
    }
    
    // Bonus: Using proper status transitions
    if (comments.includes('status ➜')) {
      score = Math.min(10, score + 1);
      feedback += ' (Good status tracking)';
    }
    
    return {
      score,
      feedback,
      weight: 10 // Status management is worth 10 points
    };
  }
  
  getBusinessHoursAge(issueDate) {
    const TicketSLAPolicy = require('../utils/ticketSLAPolicy');
    const slaPolicy = new TicketSLAPolicy();
    return slaPolicy.getBusinessHoursBetween(new Date(issueDate), new Date());
  }
  
  checkRecentTechActivity(ticket) {
    if (!ticket.comments) return false;
    
    // Look for tech responses in last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // Parse dates from comments (simplified check)
    const today = new Date().toLocaleDateString('en-US', {timeZone: 'America/New_York'});
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-US', {timeZone: 'America/New_York'});
    
    return ticket.comments.includes('Technician') && 
           (ticket.comments.includes(today) || ticket.comments.includes(yesterday));
  }

  compileFeedback(gradeDetails) {
    // Identify strengths (scores above 80% of possible)
    Object.entries(gradeDetails.scores).forEach(([category, details]) => {
      const percentage = (details.score / details.weight) * 100;
      if (percentage >= 80) {
        gradeDetails.strengths.push(`Strong ${category}: ${details.feedback}`);
      } else if (percentage < 50) {
        gradeDetails.improvements.push(`Improve ${category}: ${details.feedback}`);
      }
    });
    
    // Add best practices reminders based on grade
    if (gradeDetails.grade === 'C' || gradeDetails.grade === 'D' || gradeDetails.grade === 'F') {
      const practices = this.rules.best_practices;
      const randomPractice = practices[Math.floor(Math.random() * practices.length)];
      gradeDetails.improvements.push(`Remember: ${randomPractice}`);
    }
    
    // Check for special considerations
    this.checkSpecialConsiderations(gradeDetails);
  }

  checkSpecialConsiderations(gradeDetails) {
    // This would check for VIP customers, security issues, etc.
    // Simplified for now
    const special = this.rules.special_considerations;
    
    // Add any special feedback if needed
    if (gradeDetails.totalScore < 60) {
      const mistakes = this.rules.common_mistakes;
      const relevantMistake = mistakes[Math.floor(Math.random() * mistakes.length)];
      gradeDetails.improvements.push(`Common mistake to avoid: ${relevantMistake}`);
    }
  }

  async storeGradingHistory(gradeDetails) {
    try {
      // Read existing history
      let history = [];
      try {
        const data = await fs.readFile(this.historyFile, 'utf8');
        history = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start fresh
        history = [];
      }
      
      // Add new grade
      history.push(gradeDetails);
      
      // Keep last 1000 grades
      if (history.length > 1000) {
        history = history.slice(-1000);
      }
      
      // Save updated history
      await fs.mkdir(path.dirname(this.historyFile), { recursive: true });
      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
      
      console.log(`📊 Stored grading history (${history.length} total records)`);
      
    } catch (error) {
      console.error('Failed to store grading history:', error);
    }
  }

  async generateTrainingEmail(gradeDetails) {
    const template = this.rules.training_messages[`grade_${gradeDetails.grade}`];
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { background: ${this.getGradeColor(gradeDetails.grade)}; color: white; padding: 25px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .grade-circle { width: 80px; height: 80px; border-radius: 50%; background: white; color: ${this.getGradeColor(gradeDetails.grade)}; 
                           font-size: 36px; font-weight: bold; display: flex; align-items: center; justify-content: center; 
                           margin: 20px auto; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
            .content { padding: 25px; }
            .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .score-item { background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .score-label { color: #666; font-size: 12px; text-transform: uppercase; }
            .score-value { font-size: 24px; font-weight: bold; color: #333; }
            .feedback-section { margin: 20px 0; }
            .feedback-section h3 { color: #333; border-bottom: 2px solid #e1e5e9; padding-bottom: 10px; }
            .strength { background: #d4edda; color: #155724; padding: 10px; border-radius: 5px; margin: 5px 0; }
            .improvement { background: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin: 5px 0; }
            .tip { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${template.subject}</h1>
                <div class="grade-circle">${gradeDetails.grade}</div>
            </div>
            
            <div class="content">
                <p><strong>Ticket #${gradeDetails.ticketId}</strong> - Reviewed on ${new Date(gradeDetails.gradedAt).toLocaleString()}</p>
                <p>${template.intro}</p>
                
                <div class="score-grid">
                    <div class="score-item">
                        <div class="score-label">Overall Score</div>
                        <div class="score-value">${gradeDetails.totalScore}/100</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Response Time</div>
                        <div class="score-value">${gradeDetails.scores.responseTime.score}/${gradeDetails.scores.responseTime.weight}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Communication</div>
                        <div class="score-value">${gradeDetails.scores.communication.score}/${gradeDetails.scores.communication.weight}</div>
                    </div>
                    <div class="score-item">
                        <div class="score-label">Technical Resolution</div>
                        <div class="score-value">${gradeDetails.scores.resolution.score}/${gradeDetails.scores.resolution.weight}</div>
                    </div>
                </div>
                
                ${gradeDetails.strengths.length > 0 ? `
                <div class="feedback-section">
                    <h3>✅ What You Did Well</h3>
                    ${gradeDetails.strengths.map(s => `<div class="strength">${s}</div>`).join('')}
                </div>
                ` : ''}
                
                ${gradeDetails.improvements.length > 0 ? `
                <div class="feedback-section">
                    <h3>📈 Areas for Improvement</h3>
                    ${gradeDetails.improvements.map(i => `<div class="improvement">${i}</div>`).join('')}
                </div>
                ` : ''}
                
                <div class="tip">
                    <strong>💡 Training Tip:</strong> ${this.getRandomTip()}
                </div>
            </div>
            
            <div class="footer">
                <p>This is an automated training review to help improve your support skills.</p>
                <p>Your progress is being tracked for recognition and training opportunities.</p>
            </div>
        </div>
    </body>
    </html>`;
    
    return {
      subject: `${template.subject} - Ticket #${gradeDetails.ticketId}`,
      html,
      technician: gradeDetails.technician
    };
  }

  getGradeColor(grade) {
    const colors = {
      'A': '#28a745',
      'B': '#17a2b8',
      'C': '#ffc107',
      'D': '#fd7e14',
      'F': '#dc3545'
    };
    return colors[grade] || '#666';
  }

  getRandomTip() {
    const tips = [
      'Always put yourself in the customer\'s shoes - how would you want to be helped?',
      'Document everything - your future self and teammates will thank you.',
      'When in doubt, over-communicate rather than under-communicate.',
      'Every ticket is a chance to turn a problem into a positive experience.',
      'Learn something from every ticket - build your knowledge base daily.',
      'Response time matters, but response quality matters more.',
      'If you don\'t know something, it\'s okay to say so and find the answer.',
      'Follow up proactively - customers appreciate knowing you care.',
      'Use simple language - not everyone understands technical terms.',
      'Celebrate your wins and learn from challenges - both make you better.'
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  calculateAge(dateString) {
    if (!dateString) return 0;
    const created = new Date(dateString);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  async getTechnicianEmail(techName) {
    // Extract email from technician name format
    // Format is "domain\username" - take anything after \ and add @banyancenters.com
    
    if (!techName || techName.trim() === '') return null;
    
    // If it contains a backslash (domain\username format)
    if (techName.includes('\\')) {
      const parts = techName.split('\\');
      const username = parts[parts.length - 1]; // Get the part after the last backslash
      
      // Simply add @banyancenters.com to whatever is after the backslash
      // e.g., "rmoll" becomes "rmoll@banyancenters.com"
      // e.g., "dhruv.sharma" becomes "dhruv.sharma@banyancenters.com"
      if (username && username.trim() !== '') {
        return `${username.toLowerCase()}@banyancenters.com`;
      }
    }
    
    // If no backslash, check if it's already an email-like format
    if (techName && !techName.includes('@') && techName.trim() !== '') {
      return `${techName.toLowerCase()}@banyancenters.com`;
    }
    
    // No valid format found
    return null;
  }
}

module.exports = TechnicianTrainingService;