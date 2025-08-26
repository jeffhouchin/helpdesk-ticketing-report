// Executive Dashboard Module - Clean, focused dashboard for IT leadership
const { format } = require('date-fns');

class ExecutiveDashboard {
  constructor() {
    this.dashboardName = 'IT Executive Dashboard';
  }

  async generateExecutiveSummary(ticketData) {
    console.log('📊 Generating executive summary...');
    
    const summary = {
      totalTickets: ticketData.openTickets.length,
      urgentAlerts: ticketData.noResponseAlerts.length,
      stuckTickets: ticketData.stuckTickets.length,
      closedYesterday: ticketData.closedTickets.totalClosed || 0,
      healthScore: this.calculateHealthScore(ticketData),
      timestamp: new Date().toISOString(),
      metrics: this.extractKeyMetrics(ticketData)
    };

    return summary;
  }

  extractKeyMetrics(ticketData) {
    const openTickets = ticketData.openTickets;
    
    return {
      unassigned: openTickets.filter(t => !t.Tech_Assigned || t.Tech_Assigned.trim() === '').length,
      highPriority: openTickets.filter(t => this.isHighPriority(t)).length,
      avgAge: this.calculateAverageAge(openTickets),
      technicianWorkload: this.getTechnicianDistribution(openTickets)
    };
  }

  calculateHealthScore(ticketData) {
    const total = ticketData.openTickets.length;
    if (total === 0) return 100;

    let score = 100;
    score -= Math.min((ticketData.noResponseAlerts.length / total) * 50, 40);
    score -= Math.min((ticketData.stuckTickets.length / total) * 30, 25);
    
    return Math.max(0, Math.round(score));
  }

  calculateAverageAge(tickets) {
    if (tickets.length === 0) return 0;
    
    const now = new Date();
    const totalDays = tickets.reduce((sum, ticket) => {
      const created = new Date(ticket.IssueDate);
      const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    
    return Math.round(totalDays / tickets.length);
  }

  getTechnicianDistribution(tickets) {
    const distribution = {};
    
    tickets.forEach(ticket => {
      const tech = ticket.Tech_Assigned_Clean || 'UNASSIGNED';
      distribution[tech] = (distribution[tech] || 0) + 1;
    });
    
    return distribution;
  }

  isHighPriority(ticket) {
    const priority = (ticket.Priority || '').toLowerCase();
    return priority.includes('high') || priority.includes('critical') || priority.includes('urgent');
  }

  generateExecutiveHTML(summary) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0078d4 0%, #106ebe 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0; }
            .metric-card { padding: 30px; text-align: center; border-bottom: 1px solid #e1e5e9; }
            .metric-card:nth-child(even) { background: #f8f9fa; }
            .metric-value { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
            .metric-label { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
            .health-excellent { color: #28a745; }
            .health-good { color: #17a2b8; }
            .health-warning { color: #ffc107; }
            .health-critical { color: #dc3545; }
            .footer { padding: 20px; text-align: center; background: #f8f9fa; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎯 ${this.dashboardName}</h1>
                <p>${format(new Date(), 'EEEE, MMMM do, yyyy')} • ${format(new Date(), 'h:mm a')}</p>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${summary.totalTickets}</div>
                    <div class="metric-label">Total Open Tickets</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value ${summary.urgentAlerts > 0 ? 'health-critical' : 'health-excellent'}">${summary.urgentAlerts}</div>
                    <div class="metric-label">72+ Hour No Response</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value ${summary.stuckTickets > 0 ? 'health-warning' : 'health-excellent'}">${summary.stuckTickets}</div>
                    <div class="metric-label">Stuck Tickets (14+ days)</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value health-excellent">${summary.closedYesterday}</div>
                    <div class="metric-label">Closed Yesterday</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value ${summary.metrics.unassigned > 0 ? 'health-warning' : 'health-excellent'}">${summary.metrics.unassigned}</div>
                    <div class="metric-label">Unassigned</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value ${this.getHealthClass(summary.healthScore)}">${summary.healthScore}%</div>
                    <div class="metric-label">System Health</div>
                </div>
            </div>
            
            <div class="footer">
                <p>🤖 Generated by AI Executive Assistant • Next update: ${format(new Date(Date.now() + 24*60*60*1000), 'MMM dd, yyyy')} at 6:30 AM</p>
            </div>
        </div>
    </body>
    </html>`;
  }

  getHealthClass(score) {
    if (score >= 90) return 'health-excellent';
    if (score >= 75) return 'health-good';
    if (score >= 60) return 'health-warning';
    return 'health-critical';
  }
}

module.exports = ExecutiveDashboard;