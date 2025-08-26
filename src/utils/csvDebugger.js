// Simple CSV debugging utility to isolate parsing issues
const { parse } = require('csv-parse/sync');

class CSVDebugger {
  
  static analyzeCSVContent(csvContent, maxRecords = 5) {
    const analysis = {
      contentInfo: {
        type: typeof csvContent,
        length: csvContent?.length || 0,
        firstChars: csvContent?.substring(0, 100) || 'No content'
      },
      parsing: {
        success: false,
        recordCount: 0,
        columns: [],
        sampleRecords: [],
        errors: []
      },
      ticketAnalysis: {
        totalTickets: 0,
        validTickets: 0,
        openTickets: 0,
        dateIssues: 0,
        fieldIssues: []
      }
    };

    try {
      // Parse CSV
      console.log('🔍 Parsing CSV content...');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        escape: '"',
        quote: '"',
        ltrim: true,
        rtrim: true
      });

      analysis.parsing.success = true;
      analysis.parsing.recordCount = records.length;
      analysis.parsing.columns = records.length > 0 ? Object.keys(records[0]) : [];
      analysis.parsing.sampleRecords = records.slice(0, maxRecords);

      console.log(`✅ Parsed ${records.length} records`);
      console.log('📋 Columns found:', analysis.parsing.columns);

      // Analyze tickets
      analysis.ticketAnalysis.totalTickets = records.length;
      
      records.forEach((record, index) => {
        try {
          // Clean record (remove BOM)
          const cleanRecord = this.cleanRecord(record);
          
          // Check if valid ticket
          if (cleanRecord.IssueID && cleanRecord.IssueDate) {
            analysis.ticketAnalysis.validTickets++;
            
            // Check if open
            if (this.isTicketOpen(cleanRecord)) {
              analysis.ticketAnalysis.openTickets++;
            }
            
            // Check date parsing
            const parsedDate = this.parseDate(cleanRecord.IssueDate);
            if (!parsedDate) {
              analysis.ticketAnalysis.dateIssues++;
            }
          }
        } catch (error) {
          analysis.ticketAnalysis.fieldIssues.push({
            record: index,
            error: error.message
          });
        }
      });

      console.log('📊 Analysis Results:');
      console.log(`   Total: ${analysis.ticketAnalysis.totalTickets}`);
      console.log(`   Valid: ${analysis.ticketAnalysis.validTickets}`);
      console.log(`   Open: ${analysis.ticketAnalysis.openTickets}`);
      console.log(`   Date Issues: ${analysis.ticketAnalysis.dateIssues}`);

    } catch (error) {
      analysis.parsing.errors.push(error.message);
      console.error('❌ CSV Parsing failed:', error.message);
    }

    return analysis;
  }

  static cleanRecord(record) {
    const cleaned = {};
    
    Object.keys(record).forEach(key => {
      // Remove BOM character if present
      const cleanKey = key.replace(/^\uFEFF/, '').trim();
      const value = record[key];
      
      if (typeof value === 'string') {
        cleaned[cleanKey] = value.trim();
      } else {
        cleaned[cleanKey] = value;
      }
    });

    return cleaned;
  }

  static isTicketOpen(ticket) {
    const status = (ticket.Current_Status || '').toLowerCase();
    const closedStatuses = ['closed', 'resolved', 'completed', 'done'];
    return !closedStatuses.some(closedStatus => status.includes(closedStatus));
  }

  static parseDate(dateString) {
    if (!dateString || dateString.trim() === '') {
      return null;
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    } catch (error) {
      return null;
    }
  }
}

module.exports = CSVDebugger;