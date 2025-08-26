// Test CSV debugging locally
const CSVDebugger = require('./src/utils/csvDebugger');
const fs = require('fs');
const path = require('path');

async function testCSVDebug() {
    console.log('🧪 Testing CSV Debugging Locally...');
    
    try {
        // Load local CSV file
        const csvPath = path.join(__dirname, 'Ticket_Data_2025-08-25.csv');
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        const csvContent = fs.readFileSync(csvPath, 'utf8');
        console.log(`📊 Loaded CSV file: ${csvContent.length} characters`);
        
        // Debug the CSV
        const analysis = CSVDebugger.analyzeCSVContent(csvContent);
        
        console.log('\n🔍 DETAILED ANALYSIS:');
        console.log('==================');
        
        console.log('\n📄 Content Info:');
        console.log(`   Type: ${analysis.contentInfo.type}`);
        console.log(`   Length: ${analysis.contentInfo.length}`);
        console.log(`   First 100 chars: ${analysis.contentInfo.firstChars}`);
        
        console.log('\n📊 Parsing Results:');
        console.log(`   Success: ${analysis.parsing.success}`);
        console.log(`   Records: ${analysis.parsing.recordCount}`);
        console.log(`   Columns (${analysis.parsing.columns.length}): ${analysis.parsing.columns.join(', ')}`);
        
        if (analysis.parsing.sampleRecords.length > 0) {
            console.log('\n📋 Sample Record:');
            const sample = analysis.parsing.sampleRecords[0];
            console.log(`   IssueID: ${sample.IssueID || sample['﻿IssueID']}`);
            console.log(`   IssueDate: ${sample.IssueDate}`);
            console.log(`   Current_Status: ${sample.Current_Status}`);
            console.log(`   Priority: ${sample.Priority}`);
            console.log(`   Tech_Assigned: ${sample.Tech_Assigned}`);
        }
        
        console.log('\n🎫 Ticket Analysis:');
        console.log(`   Total Tickets: ${analysis.ticketAnalysis.totalTickets}`);
        console.log(`   Valid Tickets: ${analysis.ticketAnalysis.validTickets}`);
        console.log(`   Open Tickets: ${analysis.ticketAnalysis.openTickets}`);
        console.log(`   Date Issues: ${analysis.ticketAnalysis.dateIssues}`);
        
        if (analysis.ticketAnalysis.fieldIssues.length > 0) {
            console.log('\n❌ Field Issues:');
            analysis.ticketAnalysis.fieldIssues.slice(0, 5).forEach(issue => {
                console.log(`   Record ${issue.record}: ${issue.error}`);
            });
        }
        
        if (analysis.parsing.errors.length > 0) {
            console.log('\n❌ Parsing Errors:');
            analysis.parsing.errors.forEach(error => {
                console.log(`   ${error}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testCSVDebug();