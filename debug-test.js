// Simple debug test for Azure Function
const DailyIntelligenceEngine = require('./src/services/dailyIntelligenceEngine');

async function debugTest() {
    console.log('🔍 Debug Test Starting...');
    
    // Check environment variables
    console.log('Environment Variables:');
    console.log('- CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? 'SET' : 'MISSING');
    console.log('- SHAREPOINT_SITE_ID:', process.env.SHAREPOINT_SITE_ID ? 'SET' : 'MISSING');
    console.log('- SHAREPOINT_DRIVE_ID:', process.env.SHAREPOINT_DRIVE_ID ? 'SET' : 'MISSING');
    console.log('- SUPERVISOR_EMAIL:', process.env.SUPERVISOR_EMAIL);
    console.log('- CSV_FOLDER_PATH:', process.env.CSV_FOLDER_PATH);
    
    try {
        // Try to initialize services
        console.log('\n🔄 Testing service initialization...');
        const engine = new DailyIntelligenceEngine();
        console.log('✅ DailyIntelligenceEngine created');
        
        // Test CSV parsing with local file
        if (require('fs').existsSync('./Ticket_Data_2025-08-22.csv')) {
            console.log('✅ Test CSV file found');
        } else {
            console.log('❌ Test CSV file not found');
        }
        
    } catch (error) {
        console.error('❌ Service initialization failed:', error);
    }
}

debugTest();