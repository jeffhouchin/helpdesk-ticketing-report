# 🚀 Azure Automated Setup Guide

This guide will set up a fully automated system that runs in your Microsoft tenant with AI analysis.

## 🏗️ **Architecture Overview**

```
Azure Function (6:30 AM daily)
    ↓
SharePoint (Get CSV) → OpenAI (AI Analysis) → Exchange (Send Emails)
    ↓
Automated Reports to Supervisor + Performance Reviews to Technicians
```

## 📋 **Step 1: Azure Function Setup**

### **1.1 Create Azure Function App**

```bash
# Install Azure CLI if not already installed
# https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# Login to Azure
az login

# Create resource group
az group create --name rg-helpdesk-analysis --location eastus

# Create storage account (required for Functions)
az storage account create \
  --name sthelpdeskanalysis \
  --resource-group rg-helpdesk-analysis \
  --location eastus \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --resource-group rg-helpdesk-analysis \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name func-helpdesk-analysis \
  --storage-account sthelpdeskanalysis
```

### **1.2 Configure Function App Settings**

```bash
# Add application settings
az functionapp config appsettings set \
  --name func-helpdesk-analysis \
  --resource-group rg-helpdesk-analysis \
  --settings \
  "OPENAI_API_KEY=your_openai_key" \
  "OPENAI_MODEL=gpt-4o-mini" \
  "SHAREPOINT_SITE_ID=your_site_id" \
  "SHAREPOINT_DRIVE_ID=your_drive_id" \
  "CSV_FOLDER_PATH=/Shared Documents/Helpdesk" \
  "SUPERVISOR_EMAIL=jhouchin@banyancenters.com" \
  "SMTP_HOST=smtp.office365.com" \
  "SMTP_PORT=587"
```

## 📋 **Step 2: SharePoint Permissions**

### **2.1 Register Azure App**

1. Go to **Azure Portal** → **App Registrations** → **New registration**
2. Name: `Helpdesk Analysis Function`
3. Account types: **Accounts in this organizational directory only**
4. Click **Register**

### **2.2 Configure API Permissions**

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph**
3. Choose **Application permissions**
4. Add these permissions:
   - `Sites.ReadWrite.All` (SharePoint access)
   - `Mail.Send` (Send emails)
   - `User.Read.All` (Get user info)
5. Click **Grant admin consent**

### **2.3 Create Client Secret**

1. Go to **Certificates & secrets** → **New client secret**
2. Description: `Function App Secret`
3. Expires: **24 months**
4. Click **Add** and **copy the secret value**

### **2.4 Enable Managed Identity**

```bash
# Enable system-assigned managed identity for Function App
az functionapp identity assign \
  --name func-helpdesk-analysis \
  --resource-group rg-helpdesk-analysis
```

## 📋 **Step 3: OpenAI API Setup**

### **3.1 Get OpenAI API Key**

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. Copy the key (starts with `sk-`)

### **3.2 Cost Optimization**

```javascript
// Use gpt-4o-mini for cost efficiency
model: "gpt-4o-mini"  // $0.15 per 1M input tokens

// Typical daily usage for 200 tickets:
// - Input: ~50k tokens = $0.0075
// - Output: ~20k tokens = $0.012
// Total: ~$0.02 per day = $0.60/month
```

## 📋 **Step 4: Deploy Code**

### **4.1 Prepare Deployment Package**

```bash
# Install dependencies
npm install

# Build for Azure Functions
npm run build

# Create deployment package
func azure functionapp publish func-helpdesk-analysis --javascript
```

### **4.2 Alternative: GitHub Actions Deployment**

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure Functions

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Deploy to Azure Functions
      uses: Azure/functions-action@v1
      with:
        app-name: func-helpdesk-analysis
        package: .
        publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

## 📋 **Step 5: Configure Email Integration**

### **5.1 Exchange Online Setup**

Since you're in Microsoft 365 tenant, use Graph API for emails:

```bash
# Add these settings to Function App
az functionapp config appsettings set \
  --name func-helpdesk-analysis \
  --resource-group rg-helpdesk-analysis \
  --settings \
  "USE_GRAPH_EMAIL=true" \
  "TENANT_ID=your_tenant_id"
```

### **5.2 Technician Email Mapping**

Update the Function App settings with technician emails:

```bash
az functionapp config appsettings set \
  --name func-helpdesk-analysis \
  --resource-group rg-helpdesk-analysis \
  --settings \
  "TECH_EMAILS=rmoll@banyancenters.com,rvoyer@banyancenters.com,dmui@banyancenters.com"
```

## 📋 **Step 6: SharePoint File Organization**

### **6.1 Create SharePoint Structure**

```
📁 Helpdesk (SharePoint Site)
  📁 Shared Documents
    📁 Helpdesk
      📁 Daily_CSVs
        📄 Ticket_Data_2025-08-22.csv
        📄 Ticket_Data_2025-08-23.csv
      📁 Analysis_Results
        📄 Analysis_2025-08-22.json
        📄 Analysis_2025-08-23.json
```

### **6.2 Automated CSV Upload**

Set up your ticketing system to export daily CSV to SharePoint:
- Export runs at 6:00 AM
- Function runs at 6:30 AM
- Results by 6:35 AM

## 📋 **Step 7: Testing & Monitoring**

### **7.1 Test Function**

```bash
# Test locally first
npm run test-intelligence

# Test in Azure
func azure functionapp publish func-helpdesk-analysis --javascript

# Manual trigger test
az functionapp function invoke \
  --resource-group rg-helpdesk-analysis \
  --name func-helpdesk-analysis \
  --function-name dailyHelpdeskAnalysis
```

### **7.2 Set Up Monitoring**

1. **Application Insights** (automatically enabled)
2. **Email alerts** for function failures
3. **Cost alerts** for OpenAI usage

## 💰 **Cost Summary**

| Service | Monthly Cost |
|---------|-------------|
| Azure Function (Consumption) | $0.20 |
| OpenAI API (gpt-4o-mini) | $18.00 |
| Storage Account | $1.00 |
| **Total** | **~$19.20/month** |

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **SharePoint Access Denied**
   - Check managed identity permissions
   - Verify site ID and drive ID
   - Ensure API permissions granted

2. **OpenAI Rate Limits**  
   - Implement retry logic
   - Use gpt-4o-mini for lower costs
   - Add request delays

3. **Email Sending Fails**
   - Check Graph API permissions
   - Verify tenant ID
   - Test with simple Graph call

### **Monitoring Commands:**

```bash
# View function logs
az functionapp log tail --name func-helpdesk-analysis --resource-group rg-helpdesk-analysis

# Check function status
az functionapp show --name func-helpdesk-analysis --resource-group rg-helpdesk-analysis
```

## 🚀 **Go Live Checklist**

- [ ] Azure Function App created and configured
- [ ] SharePoint permissions granted
- [ ] OpenAI API key added
- [ ] Email permissions configured  
- [ ] Technician email mapping updated
- [ ] CSV upload process configured
- [ ] Test run successful
- [ ] Monitoring alerts configured
- [ ] Supervisor notified of go-live

## 📞 **Support**

**Azure Issues:** Check Application Insights logs  
**SharePoint Issues:** Verify permissions in Azure AD  
**OpenAI Issues:** Check API usage dashboard  
**Email Issues:** Test Graph API permissions  

---

**🎯 This setup runs everything in your Microsoft tenant with enterprise security, automatic scaling, and minimal cost while providing AI-powered insights every morning.**