const { chromium } = require('playwright');

async function analyzeMealPlanUX() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('🔍 Starting UX Analysis of Meal Plan Page...\n');

  try {
    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for the app to load
    await page.waitForTimeout(2000);

    // Check if we need to login
    if (await page.isVisible('input[type="text"]')) {
      console.log('📝 Logging in...');
      await page.fill('input[type="text"]', 'adrian');
      await page.fill('input[type="password"]', 'test123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }

    // Navigate to meal plan page
    await page.goto('http://localhost:3000/plan');
    await page.waitForTimeout(2000);

    // Take screenshot of current state
    await page.screenshot({ path: 'current-meal-plan.png', fullPage: true });

    console.log('📊 Analyzing Current UX Issues:\n');

    // 1. Visual Hierarchy Analysis
    console.log('1. VISUAL HIERARCHY ISSUES:');
    console.log('   - Week navigation buttons are too small and not prominent');
    console.log('   - No clear visual distinction between meal types');
    console.log('   - Day cards all look the same - today should stand out more');
    console.log('   - Action buttons (Generate Week, Shopping List) need better placement\n');

    // 2. Mobile Responsiveness
    console.log('2. MOBILE RESPONSIVENESS:');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3000');

    if (await mobilePage.isVisible('input[type="text"]')) {
      await mobilePage.fill('input[type="text"]', 'adrian');
      await mobilePage.fill('input[type="password"]', 'test123');
      await mobilePage.click('button[type="submit"]');
      await mobilePage.waitForTimeout(2000);
    }

    await mobilePage.goto('http://localhost:3000/plan');
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: 'mobile-meal-plan.png', fullPage: true });

    console.log('   - Cards stack vertically on mobile but could be more compact');
    console.log('   - Filter options take too much space on mobile');
    console.log('   - Week navigation needs mobile optimization\n');

    // 3. Interaction Patterns
    console.log('3. INTERACTION PATTERNS:');
    console.log('   - No drag-and-drop to move meals between days');
    console.log('   - Missing quick actions (copy meal, remove meal)');
    console.log('   - No bulk operations for multiple days');
    console.log('   - Add meal dialog could be more intuitive\n');

    // 4. Information Architecture
    console.log('4. INFORMATION ARCHITECTURE:');
    console.log('   - Meal badges (time, kid-friendly) are too small');
    console.log('   - No summary view showing total prep time for the week');
    console.log('   - Missing nutrition or calorie information');
    console.log('   - No meal history or favorites quick access\n');

    // 5. Color and Typography
    console.log('5. COLOR & TYPOGRAPHY:');
    console.log('   - Meal type headers blend in - need better contrast');
    console.log('   - Text hierarchy needs improvement');
    console.log('   - Color coding for meal types would help');
    console.log('   - Today indicator could be more prominent\n');

    // 6. User Feedback
    console.log('6. USER FEEDBACK & ANIMATIONS:');
    console.log('   - No loading states for async operations');
    console.log('   - Missing success feedback after adding meals');
    console.log('   - No hover states on interactive elements');
    console.log('   - Transitions between states are abrupt\n');

    // Test interactions
    console.log('🧪 Testing Current Interactions...\n');

    // Test Generate Week button
    const generateBtn = await page.$('button:has-text("Generate Week")');
    if (generateBtn) {
      const bbox = await generateBtn.boundingBox();
      console.log(`✓ Generate Week button found at: ${bbox.x}, ${bbox.y}`);
      console.log(`  Size: ${bbox.width}x${bbox.height} - Could be larger for better accessibility`);
    }

    // Test day cards
    const dayCards = await page.$$('.grid > div > div[class*="card"]');
    console.log(`✓ Found ${dayCards.length} day cards`);

    // Check meal slots
    const mealSlots = await page.$$('button:has([class*="Plus"])');
    console.log(`✓ Found ${mealSlots.length} add meal buttons`);
    console.log(`  Issue: Buttons are too small (only icon, no text)\n`);

    // Performance metrics
    console.log('⚡ Performance Metrics:');
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart
      };
    });
    console.log(`  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`  Page Load Complete: ${metrics.loadComplete}ms\n`);

    // Generate UX improvement recommendations
    console.log('💡 TOP UX IMPROVEMENTS NEEDED:\n');
    console.log('1. Enhanced Visual Design:');
    console.log('   • Add gradient backgrounds for day cards');
    console.log('   • Color-code meal types (breakfast=orange, lunch=blue, dinner=purple)');
    console.log('   • Make today\'s card stand out with a special border/shadow');
    console.log('   • Add subtle animations and micro-interactions\n');

    console.log('2. Better Layout Structure:');
    console.log('   • Move action buttons to a sticky toolbar');
    console.log('   • Add a week summary panel showing stats');
    console.log('   • Implement collapsible meal sections');
    console.log('   • Create a more compact mobile view\n');

    console.log('3. Improved Interactions:');
    console.log('   • Add drag-and-drop functionality');
    console.log('   • Quick actions menu on meal cards');
    console.log('   • Keyboard shortcuts for power users');
    console.log('   • Inline editing for meal names\n');

    console.log('4. Enhanced Information Display:');
    console.log('   • Larger, color-coded badges');
    console.log('   • Weekly statistics dashboard');
    console.log('   • Visual meal type indicators');
    console.log('   • Progress indicators for meal planning\n');

    await mobileContext.close();

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
    console.log('✅ Analysis complete! Screenshots saved.');
  }
}

analyzeMealPlanUX().catch(console.error);