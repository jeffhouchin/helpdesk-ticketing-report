require('dotenv').config();

module.exports = {
  // SharePoint/OneDrive
  sharepoint: {
    siteUrl: process.env.SHAREPOINT_SITE_URL,
    filePath: process.env.SHAREPOINT_FILE_PATH,
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: process.env.MICROSOFT_TENANT_ID
  },

  // Email settings
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: {
      email: process.env.FROM_EMAIL,
      name: process.env.FROM_NAME || 'Helpdesk Bot'
    }
  },

  // Analysis thresholds
  analysis: {
    staleTicketDays: parseInt(process.env.STALE_TICKET_DAYS) || 3,
    overdueTicketDays: parseInt(process.env.OVERDUE_TICKET_DAYS) || 5,
    quickWinKeywords: (process.env.QUICK_WIN_KEYWORDS || 'password,unlock,reset,printer,email').split(',').map(k => k.trim().toLowerCase()),
    managerEmail: process.env.MANAGER_EMAIL
  },

  // Notification settings
  notifications: {
    sendIndividualReminders: process.env.SEND_INDIVIDUAL_REMINDERS === 'true',
    sendDailySummary: process.env.SEND_DAILY_SUMMARY === 'true',
    summaryTime: process.env.SUMMARY_TIME || '08:00'
  }
};