# Debugging Guide for Meal Planner App

## Built-in Error Tracking & Debugging Tools

### Quick Access to Debug Tools

**Press `Ctrl+Shift+E` (or `Cmd+Shift+E` on Mac)** to open the Error Log Viewer anywhere in the app!

### Error Log Viewer Features

The Error Log Viewer provides:
- **All logged errors** with timestamps
- **Filter by type**: API, Parse, Auth, Network, Validation
- **Detailed context** for each error (endpoint, status, request data)
- **Stack traces** for debugging
- **Export as JSON** for sharing with developers
- **Statistics**: Total errors, last hour, last 24h

### Console Logging (Development Mode)

When running locally or with dev tools open, you'll see:
- `📤 API Request:` - All outgoing API calls with data
- `📥 API Response:` - All API responses with status and data
- `🔴 Error:` - Detailed error information
- `Parse result:` - Recipe parsing results

### How to Debug Recipe Parser Issues

1. **Open Browser DevTools** (F12 or Right-click → Inspect)
2. **Go to Console tab**
3. **Clear console** (Ctrl+L or click 🚫 icon)
4. **Try parsing a recipe**
5. **Look for these logs**:
   ```
   📤 API Request: POST /api/meals/parse
   Parse result: {data: {...}}
   Parse result.data: {...}
   📥 API Response: POST /api/meals/parse
   ```

6. **If you see errors**, press `Ctrl+Shift+E` to view detailed error logs
7. **Export logs** and share the JSON file

### Common Issues & Solutions

#### Issue: Recipe parses but doesn't create a card

**Check in Console**:
```javascript
console.log('Parse result:', result);
console.log('Parse result.data:', result.data);
```

**Expected flow**:
1. Parse request sent
2. Response received with recipe data
3. URL dialog closes
4. Add Recipe dialog opens with pre-filled data
5. User clicks "Add Recipe"
6. Recipe card appears in list

**If dialog doesn't open**:
- Check if `result.data` has the recipe fields (name, ingredients, etc.)
- Look for JavaScript errors in console (red text)
- Check Error Log Viewer for caught errors

#### Issue: Network/Authentication errors

**In Error Log Viewer**, look for:
- `type: "auth"` - Session or login issues
- `type: "network"` - Connection problems
- `status: 401` - Unauthorized (need to login again)
- `status: 500` - Server error

### Running E2E Tests

Test the recipe parser end-to-end:

```bash
# Install Playwright (one time)
npm install playwright

# Run tests locally
node tests/e2e_recipe_parser.js

# Run tests against Railway
TEST_URL=https://web-production-09493.up.railway.app node tests/e2e_recipe_parser.js

# Run with visible browser (see what's happening)
HEADLESS=false node tests/e2e_recipe_parser.js

# Run slower for easier observation
HEADLESS=false SLOW_MO=500 node tests/e2e_recipe_parser.js
```

**Test output includes**:
- ✅/❌ for each test step
- Screenshots on failure (in `test-screenshots/` folder)
- JSON results file with full details
- Console logs from the page

### Error Boundary

If the app crashes with a white screen:
- You'll see a friendly error page
- Click "Download Error Report" to get full details
- Click "Reload Page" to try again
- In development, you'll see the full stack trace

### API Error Context

Every API error is logged with:
```javascript
{
  endpoint: "/api/meals/parse",
  method: "POST",
  status: 500,
  requestData: { recipe_text: "..." },
  responseData: { error: "..." },
  apiBaseUrl: "https://...",
  timestamp: "2025-01-08T...",
  userAgent: "Mozilla/5.0 ...",
  currentPath: "/recipes"
}
```

### Getting Help

When reporting issues, please provide:

1. **Error logs**: Press `Ctrl+Shift+E`, click "Export JSON"
2. **Console screenshot**: Open DevTools, screenshot the Console tab
3. **Steps to reproduce**: What you clicked/typed before the error
4. **Browser info**: Chrome/Firefox/Safari version
5. **Environment**: Local (localhost:5001) or Railway (production URL)

### Development Shortcuts

- `Ctrl+Shift+E` - Error Log Viewer
- `F12` - Open DevTools
- `Ctrl+L` - Clear Console
- `Ctrl+Shift+C` - Inspect Element
- Click 🐛 button (bottom-right in dev mode) - Error Log Viewer

### Checking Recent Deployment

Railway auto-deploys from GitHub `main` branch. Latest deployment:
- **Commit**: `96d7291` - "Add comprehensive error logging and testing infrastructure"
- **Changes**: Added error logger, error boundary, E2E tests, API logging

Check deployment status:
```bash
railway status
railway logs | tail -50
```

### Files to Check

**Frontend (React)**:
- [client/src/utils/errorLogger.ts](client/src/utils/errorLogger.ts) - Error logging system
- [client/src/components/ErrorBoundary.tsx](client/src/components/ErrorBoundary.tsx) - Error boundary
- [client/src/components/ErrorLogViewer.tsx](client/src/components/ErrorLogViewer.tsx) - Log viewer UI
- [client/src/lib/api.ts](client/src/lib/api.ts) - API interceptors with logging
- [client/src/pages/RecipesPage.tsx](client/src/pages/RecipesPage.tsx:145-146) - Recipe parse handling

**Backend (Flask)**:
- [app.py](app.py) - `/api/meals/parse` endpoint

**Tests**:
- [tests/e2e_recipe_parser.js](tests/e2e_recipe_parser.js) - End-to-end test suite

## Need More Help?

The error tracking system captures detailed information automatically. Use the tools above to gather diagnostics, then share:
- Exported error logs (JSON)
- Console screenshots
- Test results

This will help quickly identify and fix any issues!
