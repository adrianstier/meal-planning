const { chromium } = require('playwright');
const { allPersonas } = require('./generate-user-personas');
const fs = require('fs');

/**
 * Automated User Testing Framework
 * Simulates 30 different user personas using the meal planning app
 * Collects feedback, identifies pain points, and generates improvement recommendations
 */

class UserTester {
  constructor(persona) {
    this.persona = persona;
    this.issues = [];
    this.successes = [];
    this.timeToComplete = {};
    this.clickCount = 0;
    this.errors = [];
  }

  // Test scenario: Plan a week of meals
  async testWeeklyPlanning(page) {
    const startTime = Date.now();
    try {
      console.log(`\n  🎯 Testing weekly planning for ${this.persona.name}...`);

      // Navigate to plan page
      await page.goto('https://web-production-09493.up.railway.app/plan', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Check if page loaded
      const titleVisible = await page.isVisible('text=Weekly Meal Plan');
      if (!titleVisible) {
        this.issues.push('Plan page did not load properly');
        return;
      }

      // Try to open recipe browser
      try {
        const recipesButton = page.locator('button:has-text("Recipes")');
        if (await recipesButton.isVisible({ timeout: 2000 })) {
          await recipesButton.click();
          this.clickCount++;
          this.successes.push('Successfully opened recipe browser');
        }
      } catch (e) {
        this.issues.push('Could not find/click Recipes button');
      }

      // Measure how long it takes to find a recipe
      const recipeSearchStart = Date.now();
      try {
        // Try to search for a recipe
        const searchBox = page.locator('input[placeholder*="Search"]').first();
        if (await searchBox.isVisible({ timeout: 2000 })) {
          await searchBox.fill('chicken');
          this.clickCount++;
          await page.waitForTimeout(500);

          const searchTime = Date.now() - recipeSearchStart;
          this.timeToComplete['recipe_search'] = searchTime;

          if (searchTime > 2000) {
            this.issues.push(`Recipe search felt slow (${searchTime}ms)`);
          } else {
            this.successes.push('Recipe search was fast');
          }
        }
      } catch (e) {
        this.issues.push('Could not use recipe search');
      }

      // Check button sizes (accessibility)
      const smallButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.filter(btn => {
          const rect = btn.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40);
        }).length;
      });

      if (smallButtons > 5) {
        this.issues.push(`Found ${smallButtons} buttons smaller than 40x40px (hard to click)`);
      }

      // Check if text is readable
      if (this.persona.age && this.persona.age > 60) {
        const smallText = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('p, span, div'));
          return elements.filter(el => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            return fontSize < 14;
          }).length;
        });

        if (smallText > 10) {
          this.issues.push(`Text too small for older users (${smallText} elements < 14px)`);
        }
      }

      this.timeToComplete['weekly_planning'] = Date.now() - startTime;

    } catch (error) {
      this.errors.push(`Weekly planning test failed: ${error.message}`);
    }
  }

  // Test scenario: Generate shopping list
  async testShoppingList(page) {
    try {
      console.log(`  🛒 Testing shopping list generation...`);

      const shoppingButton = page.locator('button:has-text("Shopping List")');
      if (await shoppingButton.isVisible({ timeout: 2000 })) {
        const startTime = Date.now();
        await shoppingButton.click();
        this.clickCount++;
        await page.waitForTimeout(1000);

        const genTime = Date.now() - startTime;
        this.timeToComplete['shopping_list'] = genTime;

        if (genTime > 3000) {
          this.issues.push('Shopping list generation too slow');
        } else {
          this.successes.push('Shopping list generated quickly');
        }
      } else {
        this.issues.push('Could not find Shopping List button');
      }
    } catch (error) {
      this.errors.push(`Shopping list test failed: ${error.message}`);
    }
  }

  // Test scenario: Mobile responsiveness (for personas who mention mobile)
  async testMobileExperience(page, context) {
    try {
      console.log(`  📱 Testing mobile experience...`);

      // Create mobile viewport
      const mobilePage = await context.newPage();
      await mobilePage.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      await mobilePage.goto('https://web-production-09493.up.railway.app/plan');
      await mobilePage.waitForTimeout(2000);

      // Check if mobile menu button is accessible
      const menuButton = mobilePage.locator('button:has-text("Menu"), button svg[class*="menu"], button svg[class*="Menu"]');
      const menuButtonVisible = await menuButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (!menuButtonVisible) {
        this.issues.push('Mobile menu button not found');
      } else {
        // Try to open the mobile menu
        try {
          await menuButton.click();
          await mobilePage.waitForTimeout(500);

          // Check if navigation items appear
          const navItemsVisible = await mobilePage.isVisible('nav a, a[href="/plan"]');
          if (navItemsVisible) {
            this.successes.push('Mobile navigation menu works correctly');
          } else {
            this.issues.push('Mobile menu does not show navigation items');
          }
        } catch (e) {
          this.issues.push('Could not open mobile menu');
        }
      }

      // Check for horizontal scroll
      const hasHorizontalScroll = await mobilePage.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      if (hasHorizontalScroll) {
        this.issues.push('Page has horizontal scroll on mobile (bad UX)');
      } else {
        this.successes.push('No horizontal scroll on mobile');
      }

      await mobilePage.close();
    } catch (error) {
      this.errors.push(`Mobile test failed: ${error.message}`);
    }
  }

  // Analyze results based on persona's priorities
  analyzeResults() {
    const report = {
      persona: {
        name: this.persona.name,
        type: this.persona.type,
        techSavvy: this.persona.techSavvy
      },
      metrics: {
        totalClicks: this.clickCount,
        timeToComplete: this.timeToComplete,
        issuesFound: this.issues.length,
        successCount: this.successes.length,
        errorCount: this.errors.length
      },
      issues: this.issues,
      successes: this.successes,
      errors: this.errors,
      satisfaction: this.calculateSatisfaction(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  calculateSatisfaction() {
    const score = (this.successes.length * 10) - (this.issues.length * 5) - (this.errors.length * 15);
    const normalized = Math.max(0, Math.min(100, 50 + score));

    let rating;
    if (normalized >= 80) rating = '😊 Very Satisfied';
    else if (normalized >= 60) rating = '🙂 Satisfied';
    else if (normalized >= 40) rating = '😐 Neutral';
    else if (normalized >= 20) rating = '😟 Frustrated';
    else rating = '😡 Very Frustrated';

    return { score: normalized, rating };
  }

  generateRecommendations() {
    const recommendations = [];

    // Based on persona-specific needs
    if (this.persona.painPoints) {
      this.persona.painPoints.forEach(pain => {
        if (pain.includes('time') && this.issues.some(i => i.includes('slow'))) {
          recommendations.push('Optimize load times and transitions');
        }
        if (pain.includes('overwhelm') && this.clickCount > 15) {
          recommendations.push('Simplify navigation - too many clicks required');
        }
      });
    }

    if (this.persona.age && this.persona.age > 60 && this.issues.some(i => i.includes('small'))) {
      recommendations.push('Increase font sizes and button sizes for senior users');
    }

    if (this.persona.techSavvy === 'Low' && this.errors.length > 0) {
      recommendations.push('Add more guidance and help text for less tech-savvy users');
    }

    return recommendations;
  }
}

// Main test runner
async function runAllUserTests() {
  console.log('\n🧪 STARTING AUTOMATED USER TESTING');
  console.log('Testing with 29 different user personas...\n');
  console.log('=' .repeat(80));

  const browser = await chromium.launch({ headless: true });
  const results = [];

  // Test all personas for comprehensive feedback
  const personasToTest = allPersonas; // Full test with all 29 personas

  for (const persona of personasToTest) {
    console.log(`\n👤 Testing as: ${persona.name} (${persona.type})`);
    console.log(`   Tech savvy: ${persona.techSavvy || 'N/A'}`);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Login first
    try {
      await page.goto('https://web-production-09493.up.railway.app/login');
      await page.waitForTimeout(1000);
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'OwtvQubm2H9BP0qE');
      await page.click('button:has-text("Sign In")');
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log(`   ❌ Login failed: ${e.message}`);
      await context.close();
      continue;
    }

    const tester = new UserTester(persona);

    // Run test scenarios
    await tester.testWeeklyPlanning(page);
    await tester.testShoppingList(page);

    if (persona.id <= 3) { // Test mobile for first few personas
      await tester.testMobileExperience(page, context);
    }

    const report = tester.analyzeResults();
    results.push(report);

    console.log(`   ✅ Complete: ${report.satisfaction.rating} (${report.satisfaction.score}/100)`);
    console.log(`   Issues: ${report.metrics.issuesFound} | Successes: ${report.metrics.successCount}`);

    await context.close();
  }

  await browser.close();

  // Generate summary report
  generateSummaryReport(results);

  // Save detailed results
  fs.writeFileSync('user-testing-results.json', JSON.stringify(results, null, 2));
  console.log('\n\n📊 Detailed results saved to: user-testing-results.json');
}

function generateSummaryReport(results) {
  console.log('\n\n📊 USER TESTING SUMMARY REPORT');
  console.log('=' .repeat(80));

  const avgSatisfaction = results.reduce((sum, r) => sum + r.satisfaction.score, 0) / results.length;
  const totalIssues = results.reduce((sum, r) => sum + r.metrics.issuesFound, 0);
  const totalSuccesses = results.reduce((sum, r) => sum + r.metrics.successCount, 0);

  console.log(`\n📈 Overall Metrics:`);
  console.log(`   Average Satisfaction: ${avgSatisfaction.toFixed(1)}/100`);
  console.log(`   Total Issues Found: ${totalIssues}`);
  console.log(`   Total Successes: ${totalSuccesses}`);
  console.log(`   Users Tested: ${results.length}`);

  // Most common issues
  const allIssues = {};
  results.forEach(r => {
    r.issues.forEach(issue => {
      allIssues[issue] = (allIssues[issue] || 0) + 1;
    });
  });

  console.log(`\n⚠️  Top Issues (fix these first):`);
  Object.entries(allIssues)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([issue, count], i) => {
      console.log(`   ${i + 1}. ${issue} (${count} users affected)`);
    });

  // Collect all recommendations
  const allRecs = {};
  results.forEach(r => {
    r.recommendations.forEach(rec => {
      allRecs[rec] = (allRecs[rec] || 0) + 1;
    });
  });

  console.log(`\n💡 Top Recommendations:`);
  Object.entries(allRecs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([rec, count], i) => {
      console.log(`   ${i + 1}. ${rec} (priority: ${count}/${results.length} users)`);
    });

  // Satisfaction distribution
  const distribution = { veryFrustrated: 0, frustrated: 0, neutral: 0, satisfied: 0, verySatisfied: 0 };
  results.forEach(r => {
    if (r.satisfaction.score >= 80) distribution.verySatisfied++;
    else if (r.satisfaction.score >= 60) distribution.satisfied++;
    else if (r.satisfaction.score >= 40) distribution.neutral++;
    else if (r.satisfaction.score >= 20) distribution.frustrated++;
    else distribution.veryFrustrated++;
  });

  console.log(`\n😊 User Satisfaction Distribution:`);
  console.log(`   😊 Very Satisfied: ${distribution.verySatisfied} (${(distribution.verySatisfied/results.length*100).toFixed(0)}%)`);
  console.log(`   🙂 Satisfied: ${distribution.satisfied} (${(distribution.satisfied/results.length*100).toFixed(0)}%)`);
  console.log(`   😐 Neutral: ${distribution.neutral} (${(distribution.neutral/results.length*100).toFixed(0)}%)`);
  console.log(`   😟 Frustrated: ${distribution.frustrated} (${(distribution.frustrated/results.length*100).toFixed(0)}%)`);
  console.log(`   😡 Very Frustrated: ${distribution.veryFrustrated} (${(distribution.veryFrustrated/results.length*100).toFixed(0)}%)`);
}

// Run the tests
runAllUserTests().catch(console.error);
