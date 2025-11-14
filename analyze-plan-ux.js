const { chromium } = require('playwright');
const fs = require('fs');

async function analyzePlanPage() {
  // Create screenshots directory
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate and login
    console.log('🔐 Logging in...');
    await page.goto('https://web-production-09493.up.railway.app/login');
    await page.waitForTimeout(2000);
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'OwtvQubm2H9BP0qE');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(5000); // Wait for redirect

    console.log('✅ Logged in successfully');
    await page.waitForTimeout(3000);

    // Capture full page screenshot
    console.log('📸 Capturing full page...');
    await page.screenshot({
      path: 'screenshots/1-plan-full-page.png',
      fullPage: true
    });

    // Capture header with controls
    console.log('📸 Capturing header area...');
    await page.screenshot({
      path: 'screenshots/2-plan-header.png',
      clip: { x: 0, y: 0, width: 1920, height: 400 }
    });

    // Open Recipe Browser
    console.log('📸 Opening Recipe Browser...');
    try {
      const recipesButton = page.locator('button', { hasText: 'Recipes' });
      await recipesButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: 'screenshots/3-recipe-browser-open.png',
        fullPage: true
      });
    } catch (e) {
      console.log('Could not open recipe browser:', e.message);
    }

    // Capture week view
    console.log('📸 Capturing week layout...');
    await page.screenshot({
      path: 'screenshots/4-week-layout.png',
      clip: { x: 250, y: 200, width: 1600, height: 800 }
    });

    // Analyze UX issues
    console.log('\n📊 UX/UI ANALYSIS REPORT');
    console.log('=' .repeat(60));

    const analysis = await page.evaluate(() => {
      const issues = [];
      const recommendations = [];

      // 1. Check button sizes
      const buttons = Array.from(document.querySelectorAll('button'));
      const smallButtons = buttons.filter(btn => {
        const rect = btn.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40);
      });

      if (smallButtons.length > 0) {
        issues.push({
          type: 'Touch Target Size',
          severity: 'Medium',
          count: smallButtons.length,
          description: `${smallButtons.length} buttons smaller than 40x40px (recommended minimum)`
        });
      }

      // 2. Check spacing and density
      const dayCards = document.querySelectorAll('[class*="day"]');
      recommendations.push({
        type: 'Visual Hierarchy',
        suggestion: 'Consider adding more visual separation between days',
        current: `${dayCards.length} day cards detected`
      });

      // 3. Check contrast
      const textElements = document.querySelectorAll('p, span, div, button, a');
      let lowContrastCount = 0;
      textElements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        // Simple heuristic - gray text on white might be low contrast
        if (color.includes('128') || color.includes('156')) {
          lowContrastCount++;
        }
      });

      if (lowContrastCount > 10) {
        issues.push({
          type: 'Color Contrast',
          severity: 'Low',
          count: lowContrastCount,
          description: 'Some elements may have insufficient contrast'
        });
      }

      // 4. Check loading states
      const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"]');
      recommendations.push({
        type: 'Loading States',
        suggestion: 'Ensure clear loading indicators for async actions',
        found: loadingIndicators.length
      });

      // 5. Mobile responsiveness check
      recommendations.push({
        type: 'Responsive Design',
        suggestion: 'Test on mobile viewports (375px, 768px, 1024px)'
      });

      return { issues, recommendations };
    });

    console.log('\n🔴 ISSUES FOUND:');
    analysis.issues.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.type} [${issue.severity}]`);
      console.log(`   ${issue.description}`);
      if (issue.count) console.log(`   Count: ${issue.count}`);
    });

    console.log('\n💡 RECOMMENDATIONS:');
    analysis.recommendations.forEach((rec, i) => {
      console.log(`\n${i + 1}. ${rec.type}`);
      console.log(`   ${rec.suggestion}`);
      if (rec.current) console.log(`   Current: ${rec.current}`);
      if (rec.found !== undefined) console.log(`   Found: ${rec.found}`);
    });

    console.log('\n\n✅ Screenshots saved to screenshots/ directory');
    console.log('Review the images to identify visual improvements needed.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

analyzePlanPage();
