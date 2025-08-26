// Simple check of email recipients configuration
console.log('🧪 Checking email recipient configuration...\n');

const supervisorEmailsFromEnv = process.env.SUPERVISOR_EMAIL || 'jhouchin@banyancenters.com,rmoll@banyancenters.com,cbowra@banyancenters.com';
const emailArray = supervisorEmailsFromEnv.split(',').map(e => e.trim());

console.log('SUPERVISOR_EMAIL environment variable:', process.env.SUPERVISOR_EMAIL || 'NOT SET');
console.log('Default email list:', supervisorEmailsFromEnv);
console.log('\n📧 Email recipients (what Azure will use):');
emailArray.forEach((email, index) => {
    console.log(`   ${index + 1}. ${email}`);
});

console.log(`\nTotal recipients: ${emailArray.length}`);
console.log('Includes Cleon (cbowra):', emailArray.some(email => email.includes('cbowra')) ? '✅ YES' : '❌ NO');
console.log('Includes Rick (rmoll):', emailArray.some(email => email.includes('rmoll')) ? '✅ YES' : '❌ NO');
console.log('Includes Jeff (jhouchin):', emailArray.some(email => email.includes('jhouchin')) ? '✅ YES' : '❌ NO');