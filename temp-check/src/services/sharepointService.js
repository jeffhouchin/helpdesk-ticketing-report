const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const XLSX = require('xlsx');
const config = require('../config');

class SharePointService {
  constructor() {
    this.clientApp = new ConfidentialClientApplication({
      auth: {
        clientId: config.sharepoint.clientId,
        clientSecret: config.sharepoint.clientSecret,
        authority: `https://login.microsoftonline.com/${config.sharepoint.tenantId}`
      }
    });
  }

  async getAccessToken() {
    try {
      const clientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      };

      const response = await this.clientApp.acquireTokenSilent(clientCredentialRequest);
      return response.accessToken;
    } catch (error) {
      console.log('Getting token from cache failed, acquiring new token...');
      const response = await this.clientApp.acquireTokenByClientCredential(clientCredentialRequest);
      return response.accessToken;
    }
  }

  async getGraphClient() {
    const accessToken = await this.getAccessToken();
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  async downloadSpreadsheet() {
    try {
      const graphClient = await this.getGraphClient();
      
      // Parse the SharePoint URL to get site and drive info
      const siteUrl = new URL(config.sharepoint.siteUrl);
      const sitePath = siteUrl.pathname;
      
      // Get the file from SharePoint
      const fileResponse = await graphClient
        .api(`/sites/${siteUrl.hostname}:${sitePath}:/drive/root:${config.sharepoint.filePath}`)
        .get();

      // Download file content
      const fileContent = await graphClient
        .api(`/drives/${fileResponse.parentReference.driveId}/items/${fileResponse.id}/content`)
        .getStream();

      return fileContent;
    } catch (error) {
      console.error('Error downloading spreadsheet:', error);
      throw error;
    }
  }

  async parseSpreadsheet() {
    try {
      const fileStream = await this.downloadSpreadsheet();
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const tickets = XLSX.utils.sheet_to_json(worksheet);
      
      console.log(`Successfully parsed ${tickets.length} tickets from spreadsheet`);
      return tickets;
    } catch (error) {
      console.error('Error parsing spreadsheet:', error);
      throw error;
    }
  }
}

module.exports = SharePointService;