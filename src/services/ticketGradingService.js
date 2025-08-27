// Ticket Grading Service - Evaluates individual ticket quality and performance
const SmartAIService = require('./smartAIService');
const TicketSLAPolicy = require('../utils/ticketSLAPolicy');

class TicketGradingService {
  constructor() {
    this.aiService = new SmartAIService();
    this.slaPolicy = new TicketSLAPolicy();
  }

  async gradeAllTickets(ticketData) {
    console.log('📊 Starting comprehensive ticket grading...');
    console.log(`🔍 Grading ${ticketData.openTickets?.length || 0} open tickets`);
    
    const gradedTickets = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the system
    
    for (let i = 0; i < ticketData.openTickets.length; i += batchSize) {
      const batch = ticketData.openTickets.slice(i, i + batchSize);
      const batchGrades = await this.gradeBatch(batch);
      gradedTickets.push(...batchGrades);
    }
    
    // Generate summary statistics
    const summary = this.generateGradingSummary(gradedTickets);
    
    return {
      type: 'ticket_grading_report',
      generated: new Date().toISOString(),
      summary,
      grades: gradedTickets,
      recommendations: this.generateRecommendations(gradedTickets, summary)
    };
  }

  async gradeBatch(tickets) {
    const grades = [];
    
    for (const ticket of tickets) {
      const grade = await this.gradeTicket(ticket);
      grades.push(grade);
    }
    
    return grades;
  }

  async gradeTicket(ticket) {
    // Calculate various metrics for grading
    const slaAnalysis = this.slaPolicy.analyzeSLA(ticket);
    const age = this.calculateAge(ticket.IssueDate);
    const responseTime = this.calculateResponseTime(ticket);
    const resolutionProgress = this.assessResolutionProgress(ticket);
    const customerSatisfaction = this.assessCustomerSatisfaction(ticket);
    
    // Calculate overall grade
    let grade = 'A';
    let score = 100;
    const issues = [];
    
    // SLA compliance (40 points)
    if (slaAnalysis.assignment.status === 'VIOLATED') {
      score -= 20;
      issues.push('Assignment SLA violated');
    }
    if (slaAnalysis.firstResponse.status === 'VIOLATED') {
      score -= 20;
      issues.push('First response SLA violated');
    }
    
    // Age factor (20 points)
    if (age > 21) {
      score -= 20;
      issues.push('Ticket older than 21 days');
    } else if (age > 14) {
      score -= 15;
      issues.push('Ticket older than 14 days');
    } else if (age > 7) {
      score -= 10;
      issues.push('Ticket older than 7 days');
    } else if (age > 3) {
      score -= 5;
      issues.push('Ticket older than 3 days');
    }
    
    // Response quality (20 points)
    if (responseTime === null) {
      score -= 20;
      issues.push('No technician response');
    } else if (responseTime > 72) {
      score -= 15;
      issues.push('Response time over 72 hours');
    } else if (responseTime > 48) {
      score -= 10;
      issues.push('Response time over 48 hours');
    } else if (responseTime > 24) {
      score -= 5;
      issues.push('Response time over 24 hours');
    }
    
    // Resolution progress (10 points)
    if (resolutionProgress.stagnant) {
      score -= 10;
      issues.push('No progress in 5+ days');
    } else if (resolutionProgress.slow) {
      score -= 5;
      issues.push('Slow progress');
    }
    
    // Customer satisfaction indicators (10 points)
    if (customerSatisfaction.frustrated) {
      score -= 10;
      issues.push('Customer appears frustrated');
    } else if (customerSatisfaction.waiting) {
      score -= 5;
      issues.push('Customer waiting for update');
    }
    
    // Calculate letter grade
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';
    
    return {
      ticketId: ticket.IssueID,
      grade,
      score,
      age,
      assigned: ticket.Tech_Assigned_Clean || 'UNASSIGNED',
      priority: this.getPriorityLevel(ticket.Priority),
      subject: (ticket.Subject || '').substring(0, 100),
      slaStatus: {
        assignment: slaAnalysis.assignment.status,
        firstResponse: slaAnalysis.firstResponse.status
      },
      issues,
      recommendations: this.generateTicketRecommendations(ticket, grade, issues),
      url: `http://helpdesk/Ticket/${ticket.IssueID}`
    };
  }

  calculateResponseTime(ticket) {
    // Look for first technician response in comments
    if (!ticket.comments || ticket.comments.length === 0) {
      return null;
    }
    
    // This is simplified - in production you'd parse actual comment timestamps
    const hasResponse = ticket.comments.toLowerCase().includes('tech:') || 
                       ticket.comments.toLowerCase().includes('assigned:');
    
    if (!hasResponse) return null;
    
    // Estimate based on ticket age and status
    const age = this.calculateAge(ticket.IssueDate);
    if (ticket.Current_Status === 'New') return null;
    if (ticket.Current_Status === 'In Progress') return Math.min(age * 24, 48);
    return 24; // Default estimate
  }

  assessResolutionProgress(ticket) {
    const age = this.calculateAge(ticket.IssueDate);
    const status = ticket.Current_Status;
    
    return {
      stagnant: age > 5 && status === 'New',
      slow: age > 10 && status !== 'Resolved',
      onTrack: age <= 3 || (age <= 7 && status === 'In Progress')
    };
  }

  assessCustomerSatisfaction(ticket) {
    const comments = (ticket.comments || '').toLowerCase();
    const body = (ticket.Ticket_Body || '').toLowerCase();
    
    const frustrationKeywords = ['urgent', 'asap', 'frustrated', 'still waiting', 
                                 'any update', 'please help', 'critical', 'emergency'];
    const waitingKeywords = ['waiting', 'update', 'status', 'when', 'how long'];
    
    const frustrated = frustrationKeywords.some(keyword => 
      comments.includes(keyword) || body.includes(keyword)
    );
    
    const waiting = waitingKeywords.some(keyword => 
      comments.includes(keyword) || body.includes(keyword)
    );
    
    return { frustrated, waiting };
  }

  generateTicketRecommendations(ticket, grade, issues) {
    const recommendations = [];
    
    if (grade === 'F') {
      recommendations.push('ESCALATE: This ticket requires immediate supervisor attention');
    }
    
    if (issues.includes('No technician response')) {
      recommendations.push('Assign technician and respond immediately');
    }
    
    if (issues.includes('Assignment SLA violated')) {
      recommendations.push('Review assignment process and workload distribution');
    }
    
    if (issues.includes('Ticket older than 21 days')) {
      recommendations.push('Schedule resolution meeting or consider closure');
    }
    
    if (issues.includes('Customer appears frustrated')) {
      recommendations.push('Proactive customer communication needed');
    }
    
    return recommendations;
  }

  generateGradingSummary(gradedTickets) {
    const gradeDistribution = {
      A: 0, B: 0, C: 0, D: 0, F: 0
    };
    
    let totalScore = 0;
    const failingTickets = [];
    const criticalIssues = [];
    
    gradedTickets.forEach(ticket => {
      gradeDistribution[ticket.grade]++;
      totalScore += ticket.score;
      
      if (ticket.grade === 'F') {
        failingTickets.push({
          id: ticket.ticketId,
          assigned: ticket.assigned,
          age: ticket.age
        });
      }
      
      if (ticket.issues.includes('Assignment SLA violated') || 
          ticket.issues.includes('No technician response')) {
        criticalIssues.push({
          id: ticket.ticketId,
          issue: ticket.issues[0]
        });
      }
    });
    
    return {
      totalTickets: gradedTickets.length,
      averageScore: Math.round(totalScore / gradedTickets.length),
      gradeDistribution,
      failingTickets,
      criticalIssues,
      performanceLevel: this.getPerformanceLevel(totalScore / gradedTickets.length)
    };
  }

  generateRecommendations(gradedTickets, summary) {
    const recommendations = [];
    
    if (summary.gradeDistribution.F > 5) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Emergency review meeting required',
        reason: `${summary.gradeDistribution.F} tickets are failing`,
        tickets: summary.failingTickets.slice(0, 5).map(t => t.id)
      });
    }
    
    if (summary.averageScore < 70) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Process improvement needed',
        reason: `Average score of ${summary.averageScore} indicates systemic issues`,
        focus: 'Review SLA compliance and response times'
      });
    }
    
    // Tech-specific recommendations
    const techPerformance = this.analyzeTechPerformance(gradedTickets);
    Object.entries(techPerformance).forEach(([tech, stats]) => {
      if (stats.avgScore < 60) {
        recommendations.push({
          priority: 'MEDIUM',
          action: `Coaching session with ${tech}`,
          reason: `Average score of ${stats.avgScore} across ${stats.tickets} tickets`,
          areas: stats.commonIssues
        });
      }
    });
    
    return recommendations;
  }

  analyzeTechPerformance(gradedTickets) {
    const techStats = {};
    
    gradedTickets.forEach(ticket => {
      const tech = ticket.assigned;
      if (!tech || tech === 'UNASSIGNED') return;
      
      if (!techStats[tech]) {
        techStats[tech] = {
          tickets: 0,
          totalScore: 0,
          grades: { A: 0, B: 0, C: 0, D: 0, F: 0 },
          commonIssues: []
        };
      }
      
      techStats[tech].tickets++;
      techStats[tech].totalScore += ticket.score;
      techStats[tech].grades[ticket.grade]++;
      techStats[tech].commonIssues.push(...ticket.issues);
    });
    
    // Calculate averages and identify patterns
    Object.keys(techStats).forEach(tech => {
      techStats[tech].avgScore = Math.round(techStats[tech].totalScore / techStats[tech].tickets);
      
      // Find most common issues
      const issueCounts = {};
      techStats[tech].commonIssues.forEach(issue => {
        issueCounts[issue] = (issueCounts[issue] || 0) + 1;
      });
      
      techStats[tech].commonIssues = Object.entries(issueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([issue]) => issue);
    });
    
    return techStats;
  }

  getPerformanceLevel(avgScore) {
    if (avgScore >= 90) return 'Excellent';
    if (avgScore >= 80) return 'Good';
    if (avgScore >= 70) return 'Satisfactory';
    if (avgScore >= 60) return 'Needs Improvement';
    return 'Critical';
  }

  calculateAge(dateString) {
    if (!dateString) return 0;
    const created = new Date(dateString);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  getPriorityLevel(priority) {
    const p = (priority || '').toLowerCase();
    if (p.includes('critical') || p.includes('urgent')) return 'CRITICAL';
    if (p.includes('high')) return 'HIGH';
    return 'NORMAL';
  }
}

module.exports = TicketGradingService;