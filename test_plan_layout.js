const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Login first
  await page.goto('http://localhost:5001');
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');

  // Wait for navigation to plan page
  await page.waitForTimeout(2000);

  // Take screenshot of current layout
  await page.screenshot({ path: 'plan_page_current.png', fullPage: true });

  // Get the header dimensions
  const header = await page.locator('.flex.items-center.justify-between').first().boundingBox();
  console.log('Header dimensions:', header);

  // Get all button positions in the header
  const buttons = await page.locator('button').all();
  console.log('\nTotal buttons on page:', buttons.length);

  console.log('\nButton positions:');
  for (let i = 0; i < Math.min(15, buttons.length); i++) {
    const box = await buttons[i].boundingBox();
    const text = await buttons[i].textContent();
    if (box && text) {
      const trimmedText = text.trim().substring(0, 30);
      console.log(`${i}: "${trimmedText}" at x:${Math.round(box.x)}, y:${Math.round(box.y)}, w:${Math.round(box.width)}, h:${Math.round(box.height)}`);
    }
  }

  await browser.close();
})();
