# Claude Code Rules & Guidelines

## Core Rules - NEVER BREAK THESE:
1. **Follow exact instructions** - Don't substitute your own assumptions
2. **Ask before deviating** - Say "Wait, this differs from your plan..." 
3. **Don't overwrite Azure environment variables** - This breaks working systems
4. **Create modular code** - Not a mess of spaghetti code
5. **Confirm the plan before executing** - Especially for deployments/changes

## Current Project Plan:
- Fix Azure CSV processing and AI analysis issues
- Use Claude 3.5 Haiku for dashboard analysis (cheap/fast)
- Use Claude 4 Opus for individual ticket grading (expensive/detailed)
- Keep existing working Azure functions intact
- Focus on CSV BOM issues and AI prompting problems

## Development Guidelines:
- **Modular architecture** - Each service has one responsibility
- **Single source of truth** - One CSV parser, one email service, etc.
- **Environment safety** - Never blank out working config
- **Test before deploy** - Local testing first, then Azure

## Current Issues to Solve:
1. Find and fix AI prompts in Azure functions
2. Fix CSV BOM/field mapping issues
3. Ensure proper data flow from CSV → AI → Dashboard

## Rules Added:
- [2025-08-26] **Separate functions by purpose** - Executive dashboard uses cheap model, individual ticket analysis uses expensive model. Different recipients, different purposes.
- [2025-08-26] **Focus on supervisor needs** - Dashboard is for helpdesk supervisor to start their day, not generic executive summary
- [2025-08-26] **Teach AI to understand CSV data structure** - AI needs to understand user vs tech responses, ticket fields, and data meaning
- [2025-08-26] **One module at a time** - Focus on Azure supervisor dashboard only, remove all individual ticket review functionality from executive function
- [2025-08-26] **CRITICAL: Avoid duplicate code paths** - Don't create new files/functions while leaving old ones. Azure may execute old code instead of new code. Audit what's actually running.