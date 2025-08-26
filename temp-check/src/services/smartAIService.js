// Smart AI Service - Cost-optimized model selection
const axios = require('axios');

class SmartAIService {
  constructor() {
    this.claudeEndpoint = 'https://api.anthropic.com/v1/messages';
    this.claudeKey = process.env.CLAUDE_API_KEY;
    
    // Cost-optimized model selection
    this.models = {
      // Fast, cheap model for bulk analysis and dashboards
      cheap: 'claude-3-5-haiku-20241022',
      
      // High-quality model for detailed individual reviews  
      expensive: 'claude-opus-4-1-20250805',
      
      // Fallback model
      fallback: 'claude-3-5-haiku-20241022'
    };
    
    // Cost tracking (optional)
    this.usage = {
      cheapCalls: 0,
      expensiveCalls: 0,
      totalTokens: 0
    };
  }

  // Executive dashboard analysis - use cheap model for bulk processing
  async analyzeForDashboard(tickets, analysisType = 'summary') {
    console.log('🏃‍♂️ Using fast model for dashboard analysis...');
    this.usage.cheapCalls++;
    
    const prompt = this.buildDashboardPrompt(tickets, analysisType);
    
    try {
      const response = await this.callClaude(this.models.cheap, prompt, 1000, 0.1);
      return this.parseDashboardResponse(response);
    } catch (error) {
      console.error('Dashboard analysis failed:', error);
      return this.getDashboardFallback(tickets);
    }
  }

  // Individual ticket analysis - use expensive model for detailed insights
  async analyzeTicketDetailed(ticket, analysisType = 'stuck_ticket') {
    console.log('🧠 Using high-quality model for detailed ticket analysis...');
    this.usage.expensiveCalls++;
    
    let prompt;
    switch (analysisType) {
      case 'stuck_ticket':
        prompt = this.buildStuckTicketPrompt(ticket);
        break;
      case 'performance_review':
        prompt = this.buildPerformancePrompt(ticket);
        break;
      default:
        prompt = this.buildGeneralTicketPrompt(ticket);
    }
    
    try {
      const response = await this.callClaude(this.models.expensive, prompt, 800, 0.2);
      return this.parseDetailedResponse(response, analysisType);
    } catch (error) {
      console.error('Detailed ticket analysis failed:', error);
      return this.getDetailedFallback(ticket, analysisType);
    }
  }

  // Batch processing for performance - cheap model
  async analyzeBatch(tickets, batchSize = 10) {
    console.log(`🔄 Batch processing ${tickets.length} tickets with cheap model...`);
    const results = [];
    
    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);
      const batchResult = await this.analyzeForDashboard(batch, 'batch');
      results.push(...batchResult);
    }
    
    return results;
  }

  async callClaude(model, prompt, maxTokens, temperature) {
    const requestData = {
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [{
        role: 'user',
        content: prompt
      }]
    };

    const response = await axios.post(this.claudeEndpoint, requestData, {
      headers: {
        'x-api-key': this.claudeKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000 // 30 second timeout
    });

    // Track token usage
    this.usage.totalTokens += (response.data.usage?.input_tokens || 0) + 
                              (response.data.usage?.output_tokens || 0);

    return response.data;
  }

  buildDashboardPrompt(tickets, analysisType) {
    const ticketSummary = tickets.slice(0, 20).map(t => ({
      id: t.IssueID,
      age: this.calculateAge(t.IssueDate),
      status: t.Current_Status,
      tech: t.Tech_Assigned_Clean || 'UNASSIGNED',
      subject: (t.Subject || '').substring(0, 100)
    }));

    return `Analyze these helpdesk tickets for executive dashboard. Be concise and focus on key metrics.

TICKETS (showing first 20 of ${tickets.length}):
${JSON.stringify(ticketSummary, null, 2)}

Provide analysis in JSON format:
{
  "summary": {
    "totalAnalyzed": ${tickets.length},
    "urgentCount": 0,
    "stuckCount": 0,
    "unassignedCount": 0,
    "avgAge": 0
  },
  "alerts": [
    {"type": "urgent", "message": "brief alert", "count": 0}
  ],
  "recommendations": [
    {"priority": "high", "action": "specific action"}
  ]
}

Keep responses under 500 tokens.`;
  }

  buildStuckTicketPrompt(ticket) {
    const age = this.calculateAge(ticket.IssueDate);
    
    return `Analyze this stuck ticket and recommend action. Be specific and actionable.

TICKET:
ID: ${ticket.IssueID}
Age: ${age} days
Subject: ${ticket.Subject || 'No subject'}
Status: ${ticket.Current_Status}
Assigned: ${ticket.Tech_Assigned_Clean || 'UNASSIGNED'}
Body: ${(ticket.Ticket_Body || '').substring(0, 600)}
Comments: ${(ticket.comments || '').substring(0, 400)}

Recommend ONE action:
- "push_closure": Simple ticket needing completion push
- "escalate_management": Needs management review  
- "close_no_response": User non-responsive
- "move_to_project": Complex scope requiring project approach

JSON response:
{
  "recommendation": "action_code",
  "confidence": 0.85,
  "reasoning": ["reason1", "reason2"],
  "immediateActions": ["specific step 1", "specific step 2"],
  "businessImpact": "brief impact statement"
}`;
  }

  buildPerformancePrompt(ticket) {
    return `Grade technician performance on this ticket. Focus on key performance indicators.

TICKET: ${ticket.IssueID} - ${ticket.Subject}
TECH: ${ticket.Tech_Assigned_Clean}
AGE: ${this.calculateAge(ticket.IssueDate)} days
ACTIVITY: ${(ticket.comments || '').substring(0, 500)}

JSON response:
{
  "grade": "A-F",
  "score": 85,
  "strengths": ["specific strength"],
  "improvements": ["specific improvement area"],
  "slaCompliance": "Met/Missed"
}`;
  }

  parseDashboardResponse(response) {
    try {
      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.getDashboardFallback([]);
    } catch (error) {
      console.error('Failed to parse dashboard response:', error);
      return this.getDashboardFallback([]);
    }
  }

  parseDetailedResponse(response, analysisType) {
    try {
      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : this.getDetailedFallback({}, analysisType);
    } catch (error) {
      console.error('Failed to parse detailed response:', error);
      return this.getDetailedFallback({}, analysisType);
    }
  }

  getDashboardFallback(tickets) {
    return {
      summary: {
        totalAnalyzed: tickets.length,
        urgentCount: 0,
        stuckCount: tickets.filter(t => this.calculateAge(t.IssueDate) > 14).length,
        unassignedCount: tickets.filter(t => !t.Tech_Assigned_Clean).length,
        avgAge: tickets.length ? Math.round(tickets.reduce((sum, t) => sum + this.calculateAge(t.IssueDate), 0) / tickets.length) : 0
      },
      alerts: [
        { type: "system", message: "AI analysis unavailable - using fallback", count: 1 }
      ],
      recommendations: [
        { priority: "high", action: "Review system manually - AI service unavailable" }
      ]
    };
  }

  getDetailedFallback(ticket, analysisType) {
    const age = this.calculateAge(ticket.IssueDate);
    
    if (analysisType === 'stuck_ticket') {
      return {
        recommendation: age > 30 ? 'escalate_management' : 'push_closure',
        confidence: 0.5,
        reasoning: ['AI analysis unavailable', 'Using age-based fallback'],
        immediateActions: ['Manual review required'],
        businessImpact: 'Unable to assess impact automatically'
      };
    }
    
    return {
      grade: 'C',
      score: 70,
      strengths: ['Unable to assess'],
      improvements: ['Manual review required'],
      slaCompliance: 'Unable to assess'
    };
  }

  calculateAge(dateString) {
    if (!dateString) return 0;
    const created = new Date(dateString);
    const now = new Date();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  // Usage reporting for cost monitoring
  getUsageReport() {
    return {
      ...this.usage,
      estimatedCost: (this.usage.cheapCalls * 0.001) + (this.usage.expensiveCalls * 0.01) // Rough estimate
    };
  }

  resetUsage() {
    this.usage = { cheapCalls: 0, expensiveCalls: 0, totalTokens: 0 };
  }
}

module.exports = SmartAIService;