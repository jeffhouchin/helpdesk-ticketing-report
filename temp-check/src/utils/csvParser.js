const fs = require('fs');
const { parse } = require('csv-parse/sync');

class CSVParser {
  constructor() {
    this.expectedColumns = [
      'IssueID',
      'IssueDate', 
      'Submitted_By',
      'Tech_Assigned',
      'Subject',
      'Ticket_Body',
      'Current_Status',
      'Priority',
      'StartDate',
      'DueDate',
      'comments'
    ];
  }

  async parseTicketCSVFromContent(csvContent) {
    try {
      console.log('📊 Parsing CSV content...');
      console.log('🔍 DEBUG: CSV content type:', typeof csvContent);
      console.log('🔍 DEBUG: CSV content length:', csvContent?.length);
      console.log('🔍 DEBUG: First 500 chars:', csvContent?.substring(0, 500));
      
      if (!csvContent || csvContent.length === 0) {
        throw new Error('CSV content is empty or null');
      }
      
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        escape: '"',
        quote: '"',
        ltrim: true,
        rtrim: true
      });

      console.log(`✅ Parsed ${records.length} records from CSV content`);
      
      if (records.length > 0) {
        console.log('🔍 DEBUG: First record keys:', Object.keys(records[0]));
        console.log('🔍 DEBUG: First record sample:', JSON.stringify(records[0], null, 2));
      }

      // Clean and validate the data
      const cleanedTickets = records.map((record, index) => {
        try {
          return this.cleanTicketRecord(record);
        } catch (error) {
          console.warn(`⚠️  Warning: Issue parsing record ${index + 1}:`, error.message);
          return null;
        }
      }).filter(ticket => ticket !== null);

      console.log(`✅ Successfully processed ${cleanedTickets.length} valid tickets`);
      
      // Log some basic stats
      this.logBasicStats(cleanedTickets);
      
      return cleanedTickets;

    } catch (error) {
      console.error('❌ Failed to parse CSV content:', error);
      throw new Error(`Failed to parse CSV content: ${error.message}`);
    }
  }

  async parseTicketCSV(filePath) {
    try {
      console.log(`📄 Reading CSV file: ${filePath}`);
      
      // Read the file content
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      // Parse CSV with proper handling for multi-line entries
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        escape: '"',
        quote: '"',
        ltrim: true,
        rtrim: true
      });

      console.log(`✅ Parsed ${records.length} records from CSV`);

      // Clean and validate the data
      const cleanedTickets = records.map((record, index) => {
        try {
          return this.cleanTicketRecord(record);
        } catch (error) {
          console.warn(`⚠️  Warning: Issue parsing record ${index + 1}:`, error.message);
          return null;
        }
      }).filter(ticket => ticket !== null);

      console.log(`✅ Successfully processed ${cleanedTickets.length} valid tickets`);
      
      // Log some basic stats
      this.logBasicStats(cleanedTickets);
      
      return cleanedTickets;

    } catch (error) {
      console.error('❌ Error parsing CSV file:', error);
      throw new Error(`Failed to parse CSV file: ${error.message}`);
    }
  }

  cleanTicketRecord(record) {
    // Remove BOM and clean up the record
    const cleaned = {};
    
    Object.keys(record).forEach(key => {
      // Remove BOM character if present
      const cleanKey = key.replace(/^\uFEFF/, '').trim();
      const value = record[key];
      
      // Clean up the value
      if (typeof value === 'string') {
        cleaned[cleanKey] = value.trim();
      } else {
        cleaned[cleanKey] = value;
      }
    });

    // Validate required fields
    if (!cleaned.IssueID || !cleaned.IssueDate) {
      throw new Error(`Missing required fields: IssueID=${cleaned.IssueID}, IssueDate=${cleaned.IssueDate}`);
    }

    // Parse and normalize dates
    cleaned.IssueDate = this.parseDate(cleaned.IssueDate);
    cleaned.StartDate = this.parseDate(cleaned.StartDate);
    cleaned.DueDate = this.parseDate(cleaned.DueDate);

    // Clean up empty fields
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === '' || cleaned[key] === null || cleaned[key] === undefined) {
        cleaned[key] = null;
      }
    });

    // Normalize status
    if (cleaned.Current_Status) {
      cleaned.Current_Status = cleaned.Current_Status.trim();
    }

    // Parse tech assignment (might have domain prefix like "bhopb\\rvoyer")
    if (cleaned.Tech_Assigned) {
      // Extract username from domain\\username format
      const techMatch = cleaned.Tech_Assigned.match(/(?:.*\\\\)?(.+)/);
      if (techMatch) {
        cleaned.Tech_Assigned_Clean = techMatch[1];
      } else {
        cleaned.Tech_Assigned_Clean = cleaned.Tech_Assigned;
      }
    }

    return cleaned;
  }

  parseDate(dateString) {
    if (!dateString || dateString.trim() === '') {
      return null;
    }

    try {
      // Handle your date format: "2025-08-22 06:58:41"
      const date = new Date(dateString);
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date format: ${dateString}`);
        return null;
      }
      
      return date;
    } catch (error) {
      console.warn(`Error parsing date "${dateString}":`, error.message);
      return null;
    }
  }

  logBasicStats(tickets) {
    const stats = {
      total: tickets.length,
      withTech: tickets.filter(t => t.Tech_Assigned && t.Tech_Assigned.trim() !== '').length,
      withoutTech: tickets.filter(t => !t.Tech_Assigned || t.Tech_Assigned.trim() === '').length,
      statusCounts: {},
      priorityCounts: {},
      recentTickets: tickets.filter(t => {
        if (!t.IssueDate) return false;
        const daysDiff = (new Date() - t.IssueDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      }).length
    };

    // Count statuses
    tickets.forEach(ticket => {
      const status = ticket.Current_Status || 'Unknown';
      stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;
    });

    // Count priorities
    tickets.forEach(ticket => {
      const priority = ticket.Priority || 'Unknown';
      stats.priorityCounts[priority] = (stats.priorityCounts[priority] || 0) + 1;
    });

    console.log('\n📊 BASIC TICKET STATS:');
    console.log(`   Total tickets: ${stats.total}`);
    console.log(`   With technician: ${stats.withTech}`);
    console.log(`   Without technician: ${stats.withoutTech}`);
    console.log(`   Recent (7 days): ${stats.recentTickets}`);
    
    console.log('   Status breakdown:');
    Object.entries(stats.statusCounts).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });

    console.log('   Priority breakdown:');
    Object.entries(stats.priorityCounts).forEach(([priority, count]) => {
      console.log(`     ${priority}: ${count}`);
    });
    console.log('');
  }
}

module.exports = CSVParser;