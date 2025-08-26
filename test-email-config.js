// Test email configuration
const EmailDispatcher = require('./src/modules/emailDispatcher');

async function testEmailConfig() {
    console.log('🧪 Testing email configuration...\n');
    
    // Test without environment variables (will use defaults)
    const emailDispatcher = new EmailDispatcher();
    console.log('Email Recipients:', emailDispatcher.supervisorEmails);
    console.log('From Address:', emailDispatcher.fromAddress);
    
    console.log('\n📧 These are the emails that would receive the dashboard:');
    emailDispatcher.supervisorEmails.forEach((email, index) => {
        console.log(`   ${index + 1}. ${email}`);
    });
}

testEmailConfig().catch(console.error);