const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');

class AzureSharePointService {
  constructor() {
    console.log('🔧 AzureSharePointService constructor called');
    console.log('🔧 Environment variables:', {
      TENANT_ID: process.env.TENANT_ID ? 'SET' : 'MISSING',
      MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID ? 'SET' : 'MISSING', 
      MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET ? 'SET' : 'MISSING',
      SHAREPOINT_SITE_ID: process.env.SHAREPOINT_SITE_ID ? 'SET' : 'MISSING'
    });
    
    // Use service principal with client credentials
    this.credential = new ClientSecretCredential(
      process.env.TENANT_ID,
      process.env.MICROSOFT_CLIENT_ID,
      process.env.MICROSOFT_CLIENT_SECRET
    );
    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await this.credential.getToken(['https://graph.microsoft.com/.default']);
          return token.token;
        }
      }
    });
    
    this.siteId = process.env.SHAREPOINT_SITE_ID;
    this.driveId = process.env.SHAREPOINT_DRIVE_ID; 
    this.csvFolderPath = process.env.CSV_FOLDER_PATH || '/Shared Documents/Helpdesk';
    
    console.log('🔧 SharePoint service initialized');
  }

  async getLatestTicketCSV() {
    try {
      console.log('🔍 Searching for latest ticket CSV...');
      console.log(`🔍 Site ID: ${this.siteId}`);
      console.log(`🔍 CSV Folder Path: ${this.csvFolderPath}`);
      
      // First, get the default drive (Documents library)
      console.log('📊 Getting drives list...');
      const drives = await this.graphClient
        .api(`/sites/${this.siteId}/drives`)
        .get();
      
      console.log(`📊 Found ${drives.value.length} drives:`, drives.value.map(d => `${d.name} (${d.id})`));
      
      const docDrive = drives.value.find(d => d.name === 'File Server') || drives.value[0];
      console.log(`📁 Using drive: ${docDrive.name} (${docDrive.id})`);
      console.log(`🌐 Full API URL: /sites/${this.siteId}/drives/${docDrive.id}/root:${this.csvFolderPath}:/children`);
      
      // Debug: List root folders first
      try {
        console.log('🔍 Listing root folders...');
        const rootFolders = await this.graphClient
          .api(`/sites/${this.siteId}/drives/${docDrive.id}/root/children`)
          .get();
        
        console.log('📁 Root folders found:', rootFolders.value.map(f => f.name));
      } catch (debugError) {
        console.log('❌ Debug listing failed:', debugError.message);
      }
      
      // Try to get files from SharePoint folder
      const files = await this.graphClient
        .api(`/sites/${this.siteId}/drives/${docDrive.id}/root:${this.csvFolderPath}:/children`)
        .get();

      // Find CSV files matching pattern - exclude closed ticket files
      const csvFiles = files.value.filter(file => 
        file.name.match(/Ticket_Data_\d{4}-\d{2}-\d{2}\.csv$/i) && 
        !file.name.toLowerCase().includes('closed')
      );

      if (csvFiles.length === 0) {
        throw new Error('No ticket CSV files found in SharePoint');
      }

      console.log(`📁 Found ${csvFiles.length} CSV files:`, csvFiles.map(f => f.name));

      // Look for today's file first
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const todaysFile = csvFiles.find(file => file.name.includes(today));
      
      let selectedFile;
      if (todaysFile) {
        selectedFile = todaysFile;
        console.log(`📄 Using today's file: ${selectedFile.name}`);
      } else {
        // Fallback to most recent file
        csvFiles.sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime));
        selectedFile = csvFiles[0];
        console.log(`⚠️  No file for today (${today}), using most recent: ${selectedFile.name}`);
      }

      // Download file content
      const fileContent = await this.graphClient
        .api(`/sites/${this.siteId}/drives/${docDrive.id}/items/${selectedFile.id}/content`)
        .get();

      console.log('🔍 DEBUG: FileContent type:', typeof fileContent);
      console.log('🔍 DEBUG: FileContent constructor:', fileContent?.constructor?.name);
      console.log('🔍 DEBUG: Is Buffer?', Buffer.isBuffer(fileContent));
      console.log('🔍 DEBUG: FileContent keys:', Object.keys(fileContent || {}));

      // Convert to string properly
      let contentString;
      if (Buffer.isBuffer(fileContent)) {
        console.log('🔍 DEBUG: Converting Buffer to string');
        contentString = fileContent.toString('utf-8');
      } else if (typeof fileContent === 'string') {
        console.log('🔍 DEBUG: Already a string');
        contentString = fileContent;
      } else if (fileContent && typeof fileContent.getReader === 'function') {
        // Handle ReadableStream properly
        console.log('🔍 DEBUG: Converting ReadableStream to string');
        const reader = fileContent.getReader();
        const chunks = [];
        let done = false;
        
        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            chunks.push(value);
          }
        }
        
        const buffer = Buffer.concat(chunks);
        contentString = buffer.toString('utf-8');
      } else if (fileContent && fileContent[Symbol.asyncIterator]) {
        // Handle Node.js ReadableStream
        console.log('🔍 DEBUG: Converting Node ReadableStream to string');
        const chunks = [];
        for await (const chunk of fileContent) {
          chunks.push(chunk);
        }
        contentString = Buffer.concat(chunks).toString('utf-8');
      } else {
        console.log('🔍 DEBUG: Unknown content type, attempting toString()');
        contentString = fileContent.toString();
      }

      console.log('🔍 DEBUG: Final content type:', typeof contentString);
      console.log('🔍 DEBUG: Content length:', contentString?.length);

      return {
        filename: selectedFile.name,
        content: contentString,
        lastModified: selectedFile.lastModifiedDateTime
      };

    } catch (error) {
      console.error('❌ SharePoint access failed:', error);
      throw new Error(`Failed to access SharePoint: ${error.message}`);
    }
  }

  async testDirectoryListing() {
    try {
      console.log('🧪 TEST: Starting directory listing test...');
      
      // Test 1: Get drives
      console.log('🧪 TEST: Getting drives...');
      const drives = await this.graphClient
        .api(`/sites/${this.siteId}/drives`)
        .get();
      
      console.log(`🧪 TEST: Found ${drives.value.length} drives:`);
      drives.value.forEach((drive, index) => {
        console.log(`   ${index}: ${drive.name} (ID: ${drive.id}) - Type: ${drive.driveType}`);
      });
      
      // Test 2: Get root contents of first drive
      const firstDrive = drives.value[0];
      let rootItemsCount = 0;
      
      if (firstDrive) {
        console.log(`🧪 TEST: Listing root contents of ${firstDrive.name}...`);
        const rootItems = await this.graphClient
          .api(`/sites/${this.siteId}/drives/${firstDrive.id}/root/children`)
          .get();
          
        rootItemsCount = rootItems.value.length;
        console.log(`🧪 TEST: Found ${rootItemsCount} items in root:`);
        rootItems.value.forEach(item => {
          console.log(`   - ${item.name} (${item.folder ? 'FOLDER' : 'FILE'})`);
        });
      }
      
      return { success: true, drives: drives.value.length, rootItems: rootItemsCount };
      
    } catch (error) {
      console.error('🧪 TEST FAILED:', error);
      throw error;
    }
  }

  async getTodaysCSV() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const expectedFileName = `Ticket_Data_${today}.csv`;
      
      console.log(`🔍 Looking for today's file: ${expectedFileName}`);
      console.log(`🔍 Site ID: ${this.siteId}`);
      console.log(`🔍 CSV Folder Path: ${this.csvFolderPath}`);

      // Get the default drive
      console.log('📊 Getting drives list for getTodaysCSV...');
      const drives = await this.graphClient
        .api(`/sites/${this.siteId}/drives`)
        .get();
      
      console.log(`📊 Found ${drives.value.length} drives:`, drives.value.map(d => `${d.name} (${d.id})`));
      const docDrive = drives.value.find(d => d.name === 'File Server') || drives.value[0];
      console.log(`📁 Using drive: ${docDrive.name} (${docDrive.id})`);

      // Try to get specific file
      const fileResponse = await this.graphClient
        .api(`/sites/${this.siteId}/drives/${docDrive.id}/root:${this.csvFolderPath}/${expectedFileName}`)
        .get();

      const fileContent = await this.graphClient
        .api(`/sites/${this.siteId}/drives/${docDrive.id}/items/${fileResponse.id}/content`)
        .get();

      return {
        filename: expectedFileName,
        content: fileContent,
        lastModified: fileResponse.lastModifiedDateTime
      };

    } catch (error) {
      console.warn(`⚠️ Today's file not found, using latest available`);
      return await this.getLatestTicketCSV();
    }
  }

  async uploadAnalysisResults(analysisData, filename) {
    try {
      const uploadPath = `${this.csvFolderPath}/Analysis_Results/${filename}`;
      
      await this.graphClient
        .api(`/sites/${this.siteId}/drives/${this.driveId}/root:${uploadPath}:/content`)
        .put(JSON.stringify(analysisData, null, 2));
        
      console.log(`📤 Analysis results uploaded: ${filename}`);
    } catch (error) {
      console.warn('⚠️ Failed to upload analysis results:', error);
      // Don't fail the main process if upload fails
    }
  }
}

module.exports = AzureSharePointService;