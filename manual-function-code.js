const { app } = require('@azure/functions');

app.http('triggerAnalysis', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('🔧 Manual helpdesk analysis trigger received');
        
        try {
            // Simple test first
            context.log('✅ Function is running successfully');
            
            return {
                status: 200,
                jsonBody: {
                    message: 'Helpdesk analysis function is working!',
                    timestamp: new Date().toISOString(),
                    status: 'success'
                }
            };
            
        } catch (error) {
            context.log.error('❌ Function failed:', error);
            
            return {
                status: 500,
                jsonBody: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
});