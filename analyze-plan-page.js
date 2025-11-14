const { chromium } = require('playwright');

async function analyzePlanPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate to the plan page
    console.log('🔍 Navigating to Plan page...');
    await page.goto('https://web-production-09493.up.railway.app/plan', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Capture full page screenshot
    console.log('📸 Capturing full page screenshot...');
    await page.screenshot({
      path: 'screenshots/plan-page-full.png',
      fullPage: true
    });

    // Capture header area
    console.log('📸 Capturing header area...');
    await page.screenshot({
      path: 'screenshots/plan-page-header.png',
      clip: { x: 0, y: 0, width: 1920, height: 200 }
    });

    // Open Recipe Browser
    console.log('📸 Capturing Recipe Browser...');
    const recipesButton = await page.locator('button:has-text("Recipes")');
    if (await recipesButton.isVisible()) {
      await recipesButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'screenshots/plan-page-with-browser.png',
        fullPage: true
      });
    }

    // Capture individual day card
    console.log('📸 Capturing day card...');
    const dayCard = await page.locator('[class*="day"]').first();
    if (await dayCard.isVisible()) {
      await dayCard.screenshot({
        path: 'screenshots/plan-page-day-card.png'
      });
    }

    // Capture meal slot
    console.log('📸 Capturing meal slot...');
    const mealSlot = await page.locator('[class*="meal"]').first();
    if (await mealSlot.isVisible()) {
      await mealSlot.screenshot({
        path: 'screenshots/plan-page-meal-slot.png'
      });
    }

    // Capture bottom action bar
    console.log('📸 Capturing action bar...');
    await page.screenshot({
      path: 'screenshots/plan-page-actions.png',
      clip: { x: 0, y: 0, width: 1920, height: 300 }
    });

    console.log('✅ Screenshots captured successfully!');

    // Analyze accessibility
    console.log('🔍 Analyzing accessibility...');
    const accessibilitySnapshot = await page.accessibility.snapshot();
    console.log('Accessibility tree:', JSON.stringify(accessibilitySnapshot, null, 2));

    // Check for common UX issues
    console.log('🔍 Checking for UX issues...');

    // 1. Check contrast ratios
    const contrastIssues = await page.evaluate(() => {
      const issues = [];
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        const color = style.color;
        if (bgColor && color && bgColor !== 'rgba(0, 0, 0, 0)') {
          // Simple check - would need more sophisticated contrast ratio calculation
          issues.push({
            tag: el.tagName,
            text: el.textContent?.substring(0, 50),
            bgColor,
            color
          });
        }
      });
      return issues.slice(0, 10); // Return first 10 for review
    });

    console.log('Sample color combinations:', contrastIssues);

    // 2. Check for small click targets
    const smallTargets = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons
        .map(btn => {
          const rect = btn.getBoundingClientRect();
          return {
            text: btn.textContent?.substring(0, 30),
            width: rect.width,
            height: rect.height,
            tooSmall: rect.width < 44 || rect.height < 44
          };
        })
        .filter(b => b.tooSmall)
        .slice(0, 10);
    });

    console.log('Small click targets (< 44px):', smallTargets);

    // 3. Check spacing and layout
    const layoutInfo = await page.evaluate(() => {
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
      };
    });

    console.log('Layout info:', layoutInfo);

  } catch (error) {
    console.error('❌ Error analyzing page:', error);
  } finally {
    await browser.close();
  }
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

analyzePlanPage();
