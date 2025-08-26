// Data Processor Module - Clean CSV processing and ticket analysis
const { parse } = require('csv-parse/sync');

class DataProcessor {
  constructor() {
    this.businessDaysCalculator = require('../utils/businessDays');
  }

  async processCSVContent(csvContent, filename = 'unknown') {
    console.log('📊 Processing CSV content...');
    
    try {
      // Parse CSV with robust settings
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        escape: '"',
        quote: '"',
        ltrim: true,
        rtrim: true
      });

      console.log(`✅ Parsed ${records.length} records from ${filename}`);

      // Clean and process tickets
      const cleanedTickets = records.map(record => this.cleanTicketRecord(record));
      const openTickets = cleanedTickets.filter(ticket => this.isTicketOpen(ticket));
      const closedTickets = cleanedTickets.filter(ticket => !this.isTicketOpen(ticket));
      
      // Analyze tickets
      const processedData = {
        filename,
        totalRecords: records.length,
        openTickets,
        closedTickets: { totalClosed: closedTickets.length },
        noResponseAlerts: this.findNoResponseTickets(openTickets),
        stuckTickets: this.findStuckTickets(openTickets),
        debug: {
          csvSize: csvContent.length,
          openCount: openTickets.length,
          closedCount: closedTickets.length
        }
      };

      console.log(`📈 Analysis complete: ${openTickets.length} open, ${closedTickets.length} closed`);
      return processedData;
      
    } catch (error) {
      console.error('❌ CSV processing failed:', error);
      throw new Error(`Failed to process CSV data: ${error.message}`);
    }
  }

  cleanTicketRecord(record) {
    const cleaned = {};
    
    Object.keys(record).forEach(key => {
      // Remove BOM character, zero-width chars, and clean key
      const cleanKey = key.replace(/^\uFEFF|\uFFFE|\u200B|\u00A0/g, '').trim();
      let value = record[key];
      
      if (typeof value === 'string') {
        value = value.replace(/^\uFEFF|\uFFFE|\u200B|\u00A0/g, '').trim();
      }
      
      cleaned[cleanKey] = value;
    });

    // Add cleaned technician field
    cleaned.Tech_Assigned_Clean = this.cleanTechnicianName(cleaned.Tech_Assigned);
    
    // Debug logging for Azure
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
      console.log(`🔍 AZURE DEBUG - Cleaned record keys:`, Object.keys(cleaned).slice(0, 5));
    }
    
    return cleaned;
  }

  cleanTechnicianName(techName) {
    if (!techName || typeof techName !== 'string') return '';
    
    return techName
      .trim()
      .replace(/[^\w\s@.-]/g, '') // Remove special chars except common ones
      .replace(/\s+/g, ' ') // Normalize spaces
      .substring(0, 50); // Limit length
  }

  isTicketOpen(ticket) {
    const status = (ticket.Current_Status || '').toLowerCase();
    const closedStatuses = ['closed', 'resolved', 'completed', 'done'];
    return !closedStatuses.some(closedStatus => status.includes(closedStatus));
  }

  findNoResponseTickets(openTickets) {
    const alerts = [];
    const thresholdDays = 3; // 72 hours = 3 business days
    
    console.log(`🔍 Checking ${openTickets.length} tickets for no tech responses...`);
    
    openTickets.forEach(ticket => {
      if (!ticket.IssueDate) return;
      
      const daysSinceCreated = this.getBusinessDaysSince(ticket.IssueDate);
      
      // Only check tickets that are old enough
      if (daysSinceCreated >= thresholdDays) {
        const lastTechResponse = this.getLastTechResponse(ticket);
        
        // If no tech response, or tech response is too old, flag it
        if (!lastTechResponse || this.getBusinessDaysSince(lastTechResponse.date) >= thresholdDays) {
          alerts.push({
            ticket,
            daysSinceCreated,
            lastTechResponse,
            urgencyLevel: this.calculateUrgency(ticket, daysSinceCreated)
          });
        }
      }
    });

    console.log(`🚨 Found ${alerts.length} tickets with no recent tech responses`);
    return alerts.sort((a, b) => b.urgencyLevel - a.urgencyLevel);
  }

  getLastTechResponse(ticket) {
    // Parse comments to find last TECH response (not user responses)
    if (!ticket.comments || ticket.comments.trim() === '') {
      return null;
    }
    
    const comments = ticket.comments;
    let lastTechResponse = null;
    
    // Look for patterns that indicate tech responses vs user responses
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
    
    return lastTechResponse;
  }

  findStuckTickets(openTickets) {
    const stuckTickets = [];
    const thresholdDays = 14;
    
    openTickets.forEach(ticket => {
      if (!ticket.IssueDate) return;
      
      const age = this.getBusinessDaysSince(ticket.IssueDate);
      
      if (age >= thresholdDays) {
        stuckTickets.push({
          ticket,
          age,
          recommendation: this.generateStuckTicketRecommendation(ticket, age),
          confidence: Math.min(age / 20, 0.95) // Higher confidence for older tickets
        });
      }
    });

    return stuckTickets.sort((a, b) => b.age - a.age);
  }

  generateStuckTicketRecommendation(ticket, age) {
    if (age > 30) return 'ESCALATE_TO_SENIOR';
    if (age > 21) return 'MANAGER_REVIEW';
    if (!ticket.Tech_Assigned_Clean) return 'ASSIGN_TECHNICIAN';
    return 'FOLLOW_UP_REQUIRED';
  }

  calculateUrgency(ticket, age) {
    let urgency = age * 10; // Base urgency
    
    const priority = (ticket.Priority || '').toLowerCase();
    if (priority.includes('high') || priority.includes('critical') || priority.includes('urgent')) {
      urgency *= 2;
    }
    
    if (!ticket.Tech_Assigned_Clean) {
      urgency *= 1.5; // Unassigned tickets more urgent
    }
    
    return Math.round(urgency);
  }

  getBusinessDaysSince(dateString) {
    if (!dateString) return 0;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 0;
      
      const now = new Date();
      const diffTime = now - date;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return Math.max(0, diffDays);
    } catch (error) {
      return 0;
    }
  }
}

module.exports = DataProcessor;