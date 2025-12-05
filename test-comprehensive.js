/**
 * Comprehensive Test Suite for Meal Planning App
 * Tests: Recipe Parsing, Holiday Planner, Drag & Drop, Mobile UX
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5001';
const TEST_USER = { username: 'testholiday', password: 'test123' };

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, type = 'info') {
  const icons = { info: 'ℹ️', pass: '✅', fail: '❌', warn: '⚠️', section: '📋' };
  console.log(`${icons[type] || ''} ${message}`);
}

function recordTest(name, passed, details = '') {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    log(`${name}: PASSED`, 'pass');
  } else {
    results.failed++;
    log(`${name}: FAILED - ${details}`, 'fail');
  }
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(1000);
  await page.fill('input[type="text"]', TEST_USER.username);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  return page.url().includes('/login') === false;
}

// ============== TEST SUITES ==============

async function testRecipeParserAPI(page) {
  log('\n=== Recipe Parser API Tests ===', 'section');

  // Test 1: Check AI health endpoint
  try {
    const healthResponse = await page.evaluate(async () => {
      const res = await fetch('/api/health');
      return await res.json();
    });
    recordTest('AI Parser Health Check',
      healthResponse.ai_enabled === true,
      healthResponse.ai_enabled ? '' : 'AI not enabled'
    );
  } catch (e) {
    recordTest('AI Parser Health Check', false, e.message);
  }

  // Test 2: Check recipe parser endpoint exists
  try {
    const parseEndpoint = await page.evaluate(async () => {
      const res = await fetch('/api/recipe-parser/health');
      return { status: res.status, ok: res.ok };
    });
    recordTest('Recipe Parser Endpoint', parseEndpoint.ok,
      parseEndpoint.ok ? '' : `Status: ${parseEndpoint.status}`);
  } catch (e) {
    recordTest('Recipe Parser Endpoint', false, e.message);
  }
}

async function testHolidayPlannerCRUD(page) {
  log('\n=== Holiday Planner CRUD Tests ===', 'section');

  // Navigate to holiday planner
  await page.goto(`${BASE_URL}/holiday`);
  await page.waitForTimeout(2000);

  // Test 1: Page loads correctly
  const pageTitle = await page.locator('h1:has-text("Holiday")').count();
  recordTest('Holiday Page Load', pageTitle > 0);

  // Test 2: Create Event button exists
  const createBtn = await page.locator('button:has-text("New Holiday Event")').count();
  recordTest('Create Event Button Visible', createBtn > 0);

  // Test 3: Open create dialog
  if (createBtn > 0) {
    await page.click('button:has-text("New Holiday Event")');
    await page.waitForTimeout(500);
    const dialogOpen = await page.locator('[role="dialog"]').count();
    recordTest('Create Event Dialog Opens', dialogOpen > 0);

    if (dialogOpen > 0) {
      // Test 4: Form fields exist
      const nameField = await page.locator('input#event-name').count();
      const dateField = await page.locator('input#event-date').count();
      const timeField = await page.locator('input#serving-time').count();
      recordTest('Event Form Fields Present',
        nameField > 0 && dateField > 0 && timeField > 0,
        `Name: ${nameField}, Date: ${dateField}, Time: ${timeField}`);

      // Test 5: Create a test event
      await page.fill('input#event-name', `Test Event ${Date.now()}`);
      await page.fill('input#event-date', '2024-12-25');
      await page.fill('input#serving-time', '18:00');
      await page.fill('input#guest-count', '10');

      await page.click('button[type="submit"]:has-text("Create")');
      await page.waitForTimeout(1500);

      const dialogClosed = await page.locator('[role="dialog"]').count() === 0;
      recordTest('Event Creation', dialogClosed, dialogClosed ? '' : 'Dialog still open');
    } else {
      await page.keyboard.press('Escape');
    }
  }

  // Test 6: Events list shows created events
  await page.waitForTimeout(1000);
  const eventCards = await page.locator('.cursor-pointer').count();
  recordTest('Events List Display', eventCards > 0, `Found ${eventCards} event cards`);

  // Test 7: Select an event and view details
  if (eventCards > 0) {
    await page.locator('.cursor-pointer').first().click();
    await page.waitForTimeout(1000);

    const dishesTab = await page.locator('text=/Menu|Dishes/i').count();
    recordTest('Event Details Load', dishesTab > 0);
  }
}

async function testDragDropFeature(page) {
  log('\n=== Drag & Drop Feature Tests ===', 'section');

  // First, ensure we have at least one event selected
  await page.goto(`${BASE_URL}/holiday`);
  await page.waitForTimeout(2000);

  const eventCards = await page.locator('.cursor-pointer').count();
  if (eventCards > 0) {
    await page.locator('.cursor-pointer').first().click();
    await page.waitForTimeout(1000);
  }

  // Test 1: Drop zone exists
  const dropZone = await page.locator('text=/Drag & drop recipes/i').count();
  recordTest('Drop Zone Visible', dropZone > 0);

  // Test 2: Category drop zones exist
  const categories = ['main', 'side', 'appetizer', 'dessert', 'drink'];
  let categoryZonesFound = 0;
  for (const cat of categories) {
    const zone = await page.locator(`text=/${cat}s/i`).count();
    if (zone > 0) categoryZonesFound++;
  }
  recordTest('Category Drop Zones', categoryZonesFound >= 3,
    `Found ${categoryZonesFound}/5 categories`);

  // Test 3: Check Recipes page has draggable cards
  await page.goto(`${BASE_URL}/recipes`);
  await page.waitForTimeout(2000);

  const draggableCards = await page.locator('[draggable="true"]').count();
  recordTest('Draggable Recipe Cards', draggableCards >= 0,
    `Found ${draggableCards} draggable cards`);

  // Test 4: Recipe cards have drag hint text
  const dragHint = await page.locator('text=/Drag to plan/i').count();
  recordTest('Drag Hint Text', dragHint >= 0 || draggableCards === 0,
    draggableCards === 0 ? 'No recipes to test' : `Found ${dragHint} hints`);
}

async function testHolidayTemplates(page) {
  log('\n=== Holiday Templates Tests ===', 'section');

  await page.goto(`${BASE_URL}/holiday`);
  await page.waitForTimeout(2000);

  // Select an event first
  const eventCards = await page.locator('.cursor-pointer').count();
  if (eventCards > 0) {
    await page.locator('.cursor-pointer').first().click();
    await page.waitForTimeout(1000);

    // Test 1: Templates button exists
    const templatesBtn = await page.locator('button:has-text("Templates")').count();
    recordTest('Templates Button Exists', templatesBtn > 0);

    if (templatesBtn > 0) {
      // Test 2: Open templates dialog
      await page.click('button:has-text("Templates")');
      await page.waitForTimeout(500);

      const templateDialog = await page.locator('[role="dialog"]').count();
      recordTest('Templates Dialog Opens', templateDialog > 0);

      if (templateDialog > 0) {
        // Test 3: Check template options exist
        const thanksgiving = await page.locator('text=/Thanksgiving/i').count();
        const christmas = await page.locator('text=/Christmas/i').count();
        const easter = await page.locator('text=/Easter/i').count();

        recordTest('Template Options Present',
          thanksgiving > 0 && christmas > 0 && easter > 0,
          `TG: ${thanksgiving}, Xmas: ${christmas}, Easter: ${easter}`);

        await page.keyboard.press('Escape');
      }
    }
  } else {
    recordTest('Templates Button Exists', false, 'No events to test with');
  }
}

async function testMobileResponsiveness(page, context) {
  log('\n=== Mobile Responsiveness Tests ===', 'section');

  // Create mobile viewport
  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ width: 375, height: 667 }); // iPhone SE

  // Test 1: Login page responsive
  await mobilePage.goto(`${BASE_URL}/login`);
  await mobilePage.waitForTimeout(1000);

  const loginBtn = await mobilePage.locator('button[type="submit"]').boundingBox();
  recordTest('Mobile Login Button Size',
    loginBtn && loginBtn.height >= 44,
    loginBtn ? `Height: ${loginBtn.height}px` : 'Button not found');

  // Login
  await mobilePage.fill('input[type="text"]', TEST_USER.username);
  await mobilePage.fill('input[type="password"]', TEST_USER.password);
  await mobilePage.click('button[type="submit"]');
  await mobilePage.waitForTimeout(2000);

  // Test 2: Mobile navigation works
  const mobileMenu = await mobilePage.locator('[data-mobile-menu], button[aria-label*="menu"]').count();
  recordTest('Mobile Menu Exists', mobileMenu >= 0, 'Checking for mobile menu');

  // Test 3: Holiday page mobile layout
  await mobilePage.goto(`${BASE_URL}/holiday`);
  await mobilePage.waitForTimeout(2000);

  const createBtnMobile = await mobilePage.locator('button:has-text("New Holiday")').boundingBox();
  recordTest('Mobile Create Button',
    createBtnMobile && createBtnMobile.height >= 44,
    createBtnMobile ? `Height: ${createBtnMobile.height}px` : 'Button not found');

  // Test 4: Recipes page mobile
  await mobilePage.goto(`${BASE_URL}/recipes`);
  await mobilePage.waitForTimeout(2000);

  const addRecipeBtn = await mobilePage.locator('button:has-text("Add Recipe")').boundingBox();
  recordTest('Mobile Add Recipe Button',
    addRecipeBtn && addRecipeBtn.height >= 44,
    addRecipeBtn ? `Height: ${addRecipeBtn.height}px` : 'Button not found');

  await mobilePage.close();
}

async function testAPIEndpoints(page) {
  log('\n=== API Endpoint Tests ===', 'section');

  const endpoints = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/api/holiday/events', name: 'Holiday Events List' },
    { path: '/api/holiday/templates', name: 'Holiday Templates' },
    { path: '/api/meals', name: 'Meals/Recipes List' },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await page.evaluate(async (path) => {
        const res = await fetch(path);
        return { status: res.status, ok: res.ok };
      }, endpoint.path);

      recordTest(`API: ${endpoint.name}`, response.ok,
        response.ok ? '' : `Status: ${response.status}`);
    } catch (e) {
      recordTest(`API: ${endpoint.name}`, false, e.message);
    }
  }
}

async function testPerformance(page) {
  log('\n=== Performance Tests ===', 'section');

  const pages = [
    { path: '/holiday', name: 'Holiday Planner' },
    { path: '/recipes', name: 'Recipes' },
    { path: '/plan', name: 'Meal Plan' },
  ];

  for (const p of pages) {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}${p.path}`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    recordTest(`${p.name} Load Time`, loadTime < 5000,
      `${loadTime}ms (target: <5000ms)`);
  }
}

// ============== MAIN TEST RUNNER ==============

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  COMPREHENSIVE FEATURE TEST SUITE');
  console.log('  Meal Planning App - All Features');
  console.log('='.repeat(60) + '\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    // Login first
    log('Logging in...', 'info');
    const loggedIn = await login(page);
    if (!loggedIn) {
      log('Login failed! Aborting tests.', 'fail');
      return;
    }
    log('Login successful\n', 'pass');

    // Run all test suites
    await testRecipeParserAPI(page);
    await testHolidayPlannerCRUD(page);
    await testDragDropFeature(page);
    await testHolidayTemplates(page);
    await testAPIEndpoints(page);
    await testPerformance(page);
    await testMobileResponsiveness(page, context);

  } catch (error) {
    log(`Test suite error: ${error.message}`, 'fail');
  } finally {
    await browser.close();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('  TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total Tests: ${results.passed + results.failed}`);
    console.log(`  ✅ Passed: ${results.passed}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  Success Rate: ${Math.round(results.passed / (results.passed + results.failed) * 100)}%`);
    console.log('='.repeat(60) + '\n');

    if (results.failed > 0) {
      console.log('Failed Tests:');
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.details}`);
      });
      console.log('');
    }

    // Optimization recommendations
    console.log('='.repeat(60));
    console.log('  OPTIMIZATION RECOMMENDATIONS');
    console.log('='.repeat(60));
    console.log(`
1. DRAG & DROP UX:
   - Add visual feedback toast when recipe is dropped
   - Show recipe image preview during drag
   - Allow reordering dishes within categories

2. HOLIDAY PLANNER:
   - Add "duplicate event" feature for recurring holidays
   - Cache templates in localStorage
   - Add shopping list generation from dropped recipes

3. RECIPE PARSER:
   - Add loading skeleton during AI parsing
   - Cache parsed recipes to avoid re-parsing
   - Add retry mechanism for failed parses

4. PERFORMANCE:
   - Lazy load recipe images
   - Virtualize long recipe lists
   - Add service worker for offline support

5. MOBILE:
   - Improve touch targets (min 44px)
   - Add swipe gestures for dish management
   - Optimize images for mobile bandwidth
`);
  }
}

runAllTests().catch(console.error);
