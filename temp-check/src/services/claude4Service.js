const axios = require('axios');

class Claude4Service {
  constructor() {
    this.claudeEndpoint = 'https://api.anthropic.com/v1/messages';
    this.claudeKey = process.env.CLAUDE_API_KEY;
    
    // Use Claude 4 models - Opus for highest quality analysis
    this.sonnetModel = 'claude-4-sonnet-20241022';
    this.opusModel = 'claude-opus-4-1-20250805';  // Updated to correct Opus model
    
    // Default to Opus for maximum analysis quality
    this.defaultModel = this.opusModel;
  }

  async analyzeStuckTicket(ticket) {
    // Use Opus for stuck ticket analysis - maximum quality insights
    const prompt = this.buildStuckTicketPrompt(ticket);
    
    try {
      const response = await this.callClaude(this.opusModel, prompt, 400, 0.1);
      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('Claude 4 stuck ticket analysis failed:', error);
      return this.getFallbackRecommendation(ticket);
    }
  }

  async gradeTicketPerformance(ticket, techResponses, userResponses) {
    // Use Opus for performance reviews - highest quality analysis
    const prompt = this.buildPerformancePrompt(ticket, techResponses, userResponses);
    
    try {
      const response = await this.callClaude(this.opusModel, prompt, 500, 0.2);
      return this.parsePerformanceResponse(response);
    } catch (error) {
      console.error('Claude 4 performance grading failed:', error);
      return this.getFallbackGrade(ticket, techResponses.length);
    }
  }

  async generateExecutiveSummary(analysisResults) {
    // Use Opus for executive summary - maximum quality reporting
    const model = this.opusModel;
    
    const prompt = `Generate an executive summary of today's helpdesk analysis:

ANALYSIS RESULTS:
${JSON.stringify(analysisResults, null, 2)}

Provide a concise executive summary focusing on:
1. Key performance trends
2. Critical issues requiring attention
3. Team performance highlights
4. Strategic recommendations for management

Format as professional executive brief.`;

    try {
      const response = await this.callClaude(model, prompt, 600, 0.3);
      return response.content[0].text;
    } catch (error) {
      console.error('Executive summary generation failed:', error);
      return 'Executive summary unavailable due to AI service issue.';
    }
  }

  async callClaude(model, prompt, maxTokens, temperature) {
    const response = await axios.post(this.claudeEndpoint, {
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [{
        role: 'user',
        content: prompt
      }]
    }, {
      headers: {
        'x-api-key': this.claudeKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data;
  }

  buildStuckTicketPrompt(ticket) {
    const age = Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24));
    
    return `You are a senior helpdesk manager analyzing stuck tickets. Provide management-grade analysis.

TICKET ANALYSIS:
==============
Ticket #${ticket.IssueID}
Subject: ${ticket.Subject || 'No subject'}
Age: ${age} business days
Status: ${ticket.Current_Status || 'Unknown'}
Assigned: ${ticket.Tech_Assigned_Clean || 'Unassigned'}
Priority: ${ticket.Priority || 'Normal'}

ORIGINAL REQUEST:
${ticket.Ticket_Body ? ticket.Ticket_Body.substring(0, 600) : 'No description available'}

ACTIVITY HISTORY:
${ticket.comments ? ticket.comments.substring(0, 1200) : 'No activity recorded'}

ANALYSIS REQUIRED:
This ticket has been open for ${age} business days. Analyze the situation and recommend ONE action:

1. "push_to_closure" - Simple ticket requiring completion push
2. "move_to_project" - Complex issue needing project management approach  
3. "close_no_response" - User non-responsive after documented contact attempts
4. "escalate_management" - Requires management review and decision

Consider:
- Communication patterns between tech and user
- Complexity of the underlying issue
- Evidence of progress or lack thereof  
- Resource requirements and scope

Respond in JSON format:
{
  "recommendation": "action_code",
  "confidence": 0.85,
  "reasoning": ["detailed_reason_1", "detailed_reason_2", "detailed_reason_3"],
  "action_plan": "Specific immediate steps to take",
  "business_impact": "Impact if this ticket remains unresolved",
  "estimated_effort": "Time/resource estimate to resolve"
}`;
  }

  buildPerformancePrompt(ticket, techResponses, userResponses) {
    const age = Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24));
    
    return `You are evaluating technician performance on a helpdesk ticket. Provide detailed assessment.

PERFORMANCE REVIEW:
==================
Ticket #${ticket.IssueID}
Subject: ${ticket.Subject || 'No subject'}
Age: ${age} business days
Technician: ${ticket.Tech_Assigned_Clean}
Status: ${ticket.Current_Status}

INTERACTION METRICS:
- Technician responses: ${techResponses.length}
- User responses: ${userResponses.length}
- Ticket age: ${age} business days

ACTIVITY TIMELINE:
${ticket.comments ? ticket.comments.substring(0, 1000) : 'No activity available'}

EVALUATION CRITERIA:
Assess performance across these dimensions:
1. Response timeliness and SLA compliance
2. Communication clarity and professionalism  
3. Problem-solving approach and technical competence
4. Customer service and user experience
5. Follow-through and closure effectiveness

Consider:
- Business day expectations (not weekends/holidays)
- Complexity of the issue
- User responsiveness and cooperation
- Process adherence and documentation

Provide constructive feedback with specific examples from the ticket.

Respond in JSON format:
{
  "grade": "A-F letter grade",
  "score": 85,
  "strengths": ["specific_strength_1", "specific_strength_2"],
  "weaknesses": ["specific_weakness_1", "specific_weakness_2"],
  "recommendations": ["specific_recommendation_1", "specific_recommendation_2"],
  "sla_compliance": "Met/Missed with explanation",
  "communication_quality": "Assessment of communication effectiveness"
}`;
  }

  parseAnalysisResponse(response) {
    try {
      const content = response.content[0].text;
      // Extract JSON from response (Claude might include explanatory text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse Claude analysis response:', error);
      return this.getFallbackRecommendation();
    }
  }

  parsePerformanceResponse(response) {
    try {
      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse Claude performance response:', error);
      return this.getFallbackGrade();
    }
  }

  getFallbackRecommendation(ticket) {
    const age = ticket ? Math.floor((new Date() - ticket.IssueDate) / (1000 * 60 * 60 * 24)) : 30;
    
    return {
      recommendation: age > 30 ? 'escalate_management' : 'push_to_closure',
      confidence: 0.5,
      reasoning: ['AI analysis unavailable', 'Using fallback logic'],
      action_plan: 'Manual review required due to AI service unavailability',
      business_impact: 'Unable to assess - requires manual analysis',
      estimated_effort: 'Unknown - manual assessment needed'
    };
  }

  getFallbackGrade(ticket, responseCount = 0) {
    let score = 70;
    if (responseCount === 0) score -= 30;
    if (responseCount > 0) score += 10;
    
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    
    return {
      grade,
      score: Math.max(0, score),
      strengths: responseCount > 0 ? ['Has provided responses'] : [],
      weaknesses: responseCount === 0 ? ['No responses recorded'] : ['Limited data available'],
      recommendations: ['AI performance analysis unavailable - manual review required'],
      sla_compliance: 'Unable to assess',
      communication_quality: 'Unable to assess'
    };
  }
}

module.exports = Claude4Service;