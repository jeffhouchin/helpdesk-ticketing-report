const axios = require('axios');

class ClaudeAIService {
  constructor() {
    this.claudeEndpoint = 'https://api.anthropic.com/v1/messages';
    this.claudeKey = process.env.CLAUDE_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022'; // Cheapest option
  }

  async analyzeStuckTicket(ticket) {
    const prompt = this.buildTicketAnalysisPrompt(ticket);
    
    try {
      const response = await axios.post(this.claudeEndpoint, {
        model: this.model,
        max_tokens: 300,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `${this.getSystemPrompt()}\n\n${prompt}`
        }]
      }, {
        headers: {
          'x-api-key': this.claudeKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });

      // Parse Claude's response
      const content = response.data.content[0].text;
      return JSON.parse(content);
      
    } catch (error) {
      console.error('Claude analysis failed:', error);
      return this.getFallbackRecommendation(ticket);
    }
  }

  async gradeTicketPerformance(ticket, techResponses, userResponses) {
    const prompt = this.buildPerformancePrompt(ticket, techResponses, userResponses);
    
    try {
      const response = await axios.post(this.claudeEndpoint, {
        model: this.model,
        max_tokens: 400,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: `${this.getPerformanceSystemPrompt()}\n\n${prompt}`
        }]
      }, {
        headers: {
          'x-api-key': this.claudeKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      });

      const content = response.data.content[0].text;
      return JSON.parse(content);
      
    } catch (error) {
      console.error('Claude performance grading failed:', error);
      return this.getFallbackGrade(ticket, techResponses.length);
    }
  }

  getSystemPrompt() {
    return `You are a helpdesk management AI assistant. Analyze tickets and provide actionable recommendations.

For tickets 14+ days old, recommend ONE of these actions:
1. "push_to_closure" - Simple ticket that needs completion
2. "move_to_project" - Complex issue needing project management  
3. "close_no_response" - User not responding after contact attempts
4. "escalate_management" - Needs supervisor review

Respond ONLY in valid JSON format:
{
  "recommendation": "push_to_closure",
  "confidence": 0.85,
  "reasoning": ["reason1", "reason2"],
  "action_plan": "Specific next steps"
}`;
  }

  getPerformanceSystemPrompt() {
    return `You are a helpdesk performance evaluator. Grade technician performance on individual tickets.

Consider:
- Response timeliness
- Communication quality
- Problem-solving approach  
- Customer service
- Follow-through

Respond ONLY in valid JSON format:
{
  "grade": "B",
  "score": 78,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;
  }

  buildTicketAnalysisPrompt(ticket) {
    const age = Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24));
    
    return `TICKET ANALYSIS REQUEST:

Ticket #${ticket.IssueID}
Subject: ${ticket.Subject || 'No subject'}
Age: ${age} days
Status: ${ticket.Current_Status || 'Unknown'}
Assigned to: ${ticket.Tech_Assigned_Clean || 'Unassigned'}
Priority: ${ticket.Priority || 'Normal'}

Original Request:
${ticket.Ticket_Body ? ticket.Ticket_Body.substring(0, 500) : 'No description'}

Comments/Activity:
${ticket.comments ? ticket.comments.substring(0, 1000) : 'No comments'}

ANALYSIS: This ticket is ${age} days old. What should be done with it?`;
  }

  buildPerformancePrompt(ticket, techResponses, userResponses) {
    const age = Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24));
    
    return `PERFORMANCE REVIEW REQUEST:

Ticket #${ticket.IssueID}
Subject: ${ticket.Subject || 'No subject'}
Age: ${age} days
Status: ${ticket.Current_Status}
Technician: ${ticket.Tech_Assigned_Clean}

Tech Responses: ${techResponses.length}
User Responses: ${userResponses.length}

Recent Activity:
${ticket.comments ? ticket.comments.substring(0, 800) : 'No activity'}

EVALUATE: How well did the technician handle this ticket? Grade A-F with specific feedback.`;
  }

  getFallbackRecommendation(ticket) {
    const age = Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24));
    
    if (age > 30) {
      return {
        recommendation: 'escalate_management',
        confidence: 0.6,
        reasoning: ['Ticket extremely old', 'Needs management review'],
        action_plan: 'Escalate to supervisor for review and decision'
      };
    }
    
    return {
      recommendation: 'push_to_closure', 
      confidence: 0.5,
      reasoning: ['Default recommendation', 'AI analysis unavailable'],
      action_plan: 'Review ticket and determine next steps'
    };
  }

  getFallbackGrade(ticket, responseCount) {
    const age = Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24));
    
    let score = 70;
    if (responseCount === 0 && age > 1) score -= 30;
    if (responseCount > 0) score += 10;
    
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    
    return {
      grade,
      score: Math.max(0, score),
      strengths: responseCount > 0 ? ['Has responded to ticket'] : [],
      weaknesses: responseCount === 0 ? ['No response provided'] : [],
      recommendations: ['AI grading unavailable - manual review needed']
    };
  }
}

module.exports = ClaudeAIService;