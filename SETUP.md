# 🎯 Daily Helpdesk Intelligence System - Setup Guide

This system provides automated daily analysis of your helpdesk tickets with AI-powered insights, performance reviews, and supervisor notifications.

## 🚀 **What It Does Every Morning at 6:30 AM:**

1. **📊 Daily Overview Report** - Comprehensive dashboard sent to supervisor
2. **🚨 72-Hour No-Response Alerts** - Immediate notification for neglected tickets  
3. **🤖 AI Stuck Ticket Analysis** - Smart recommendations for 14+ day old tickets
4. **📝 Random Performance Reviews** - 10% of tickets reviewed with grades sent to technicians
5. **📈 Closed Ticket Analysis** - Quality assessment of previous day's resolutions

## 📋 **Prerequisites**

- Node.js 18+ installed
- Access to your helpdesk CSV exports
- Email server (SMTP) credentials
- GitHub account (for automation)

## ⚙️ **Setup Instructions**

### 1. **Environment Configuration**

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required Settings:**
```env
# Email Configuration
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=helpdesk-bot@banyancenters.com
SMTP_PASS=your_app_password
FROM_EMAIL=helpdesk-bot@banyancenters.com
FROM_NAME=Helpdesk AI Assistant

# Supervisor Notifications
SUPERVISOR_EMAIL=jhouchin@banyancenters.com

# Analysis Thresholds
STALE_TICKET_DAYS=3
STUCK_TICKET_DAYS=14
PERFORMANCE_SAMPLE_RATE=0.10
```

### 2. **Install Dependencies**

```bash
npm install
```

### 3. **Technician Email Mapping**

Update `src/services/intelligentEmailService.js` with your technician email addresses:

```javascript
const techEmailMap = {
  'BHOPB\\rmoll': 'rmoll@banyancenters.com',
  'bhopb\\rvoyer': 'rvoyer@banyancenters.com',
  'BHOPB\\dmui': 'dmui@banyancenters.com',
  // Add all your technicians here
};
```

### 4. **CSV File Setup**

The system expects daily CSV files named: `Ticket_Data_YYYY-MM-DD.csv`

**Options for CSV delivery:**
- **Manual Upload:** Place CSV in project root daily
- **SharePoint Integration:** Configure SharePoint API (see SharePoint setup below)  
- **Automated Download:** Modify `dailyRunner.js` to download from your source

### 5. **GitHub Actions Automation**

Set up GitHub repository secrets:

1. Go to your repo → Settings → Secrets and variables → Actions
2. Add these secrets:

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_password
FROM_EMAIL=your_email@domain.com
SUPERVISOR_EMAIL=manager@domain.com
```

## 🧪 **Testing**

### Test Basic Analysis:
```bash
npm run test-intelligence
```

### Test Email System (Dry Run):
```bash
npm run daily-analysis:dry-run
```

### Test Full System:
```bash
npm run daily-analysis
```

## 📧 **Email Outputs**

### **Supervisor Daily Report Includes:**
- 📊 Executive dashboard with key metrics
- 🚨 72+ hour no-response alerts
- 🤖 AI recommendations for stuck tickets  
- 📝 Performance review summaries
- 👥 Technician workload distribution
- 📈 Previous day's completion analysis

### **Individual Performance Reviews Include:**
- 📋 Ticket details and timeline
- 🎯 Letter grade (A-F) with percentage score
- ✅ Identified strengths
- ⚠️ Areas for improvement  
- 💡 Specific recommendations

### **72-Hour Alert Contains:**
- 🚨 List of tickets with no response
- 📅 Age and urgency scoring
- 👤 Assigned technician identification
- 🎯 Recommended immediate actions

## 🔧 **Customization Options**

### **Modify Analysis Thresholds:**
```env
STALE_TICKET_DAYS=3          # When tickets become "stale"
STUCK_TICKET_DAYS=14         # When AI evaluates for closure
PERFORMANCE_SAMPLE_RATE=0.10  # Percentage of tickets to review
```

### **Add Custom Quick Win Patterns:**
Edit `src/services/intelligentTicketAnalyzer.js`:
```javascript
this.quickWinPatterns = {
  passwords: ['password', 'reset password', 'unlock'],
  // Add your custom patterns
};
```

### **Modify Email Templates:**
Customize HTML templates in `src/services/intelligentEmailService.js`

## 🤖 **AI Recommendations for Stuck Tickets**

The AI evaluates 14+ day old tickets and suggests:

1. **📋 Push to Closure** - Simple tickets that need completion
2. **🗂️ Move to Project Management** - Complex issues needing project approach  
3. **❌ Close Due to No User Response** - User has been contacted but not responding
4. **⬆️ Escalate to Management** - High complexity requiring supervisor review

Each recommendation includes:
- 🎯 Confidence percentage
- 📝 Detailed reasoning
- 📊 Supporting metrics
- 🔧 Suggested action plan

## 📅 **Daily Schedule**

- **6:30 AM:** Analysis runs automatically
- **6:35 AM:** Supervisor report sent
- **6:40 AM:** Individual performance reviews sent to technicians  
- **6:45 AM:** 72-hour alerts sent (if any)

## 🔍 **Monitoring & Logs**

### **View Analysis Logs:**
- GitHub Actions: Repo → Actions tab
- Local: Console output when running manually

### **Failed Run Notifications:**
- Automatic email to supervisor if system fails
- GitHub Actions status notifications
- Error details included in notification

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **No CSV file found**
   - Ensure CSV is named correctly: `Ticket_Data_YYYY-MM-DD.csv`
   - Check file permissions and location

2. **Email sending fails**
   - Verify SMTP credentials in `.env`
   - Check firewall/network restrictions
   - Ensure app passwords are used (not regular passwords)

3. **Performance reviews not sending**
   - Check technician email mapping
   - Verify email addresses are correct
   - Check spam/junk folders

4. **GitHub Actions failing**
   - Verify all secrets are set correctly  
   - Check Actions tab for detailed error logs
   - Ensure dependencies are properly installed

## 📞 **Support**

For issues or questions:
1. Check GitHub Actions logs first
2. Review console output for errors
3. Verify all configuration settings
4. Contact system administrator

## 🔄 **Manual Execution**

Run analysis manually anytime:
```bash
# Full analysis with emails
npm run daily-analysis

# Test run without emails  
npm run daily-analysis:dry-run

# Just the intelligence analysis
npm run test-intelligence
```

---

**🎯 This system transforms your helpdesk management from reactive to proactive, ensuring no ticket falls through the cracks and maintaining high service quality standards.**