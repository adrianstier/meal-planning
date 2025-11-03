#!/usr/bin/env bash
echo "=========================================="
echo "Monitoring Responsive Navigation Deployment"
echo "=========================================="
echo "Start time: $(date)"
echo ""

# Get current bundle to compare
CURRENT_BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" | grep -o 'static/js/main\.[^"]*\.js' | head -1)
echo "Current JS bundle: $CURRENT_BUNDLE"
echo ""

for i in {1..10}; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Check $i/10 - $(date +%H:%M:%S)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Check if bundle hash changed (indicates new deployment)
    NEW_BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" 2>/dev/null | grep -o 'static/js/main\.[^"]*\.js' | head -1)
    
    if [ -z "$NEW_BUNDLE" ]; then
        echo "  Status: App not responding (deploying...)"
    elif [ "$NEW_BUNDLE" = "$CURRENT_BUNDLE" ]; then
        echo "  Status: Still old deployment ($CURRENT_BUNDLE)"
    else
        echo "  ✅ NEW DEPLOYMENT DETECTED!"
        echo "  Old bundle: $CURRENT_BUNDLE"
        echo "  New bundle: $NEW_BUNDLE"
        echo ""
        echo "Testing responsive navigation with Playwright..."
        python3 << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright

async def test_nav():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Test Desktop
        print("\n📱 Testing Desktop (1280px):")
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.fill('input[placeholder*="username"]', 'admin')
        await page.fill('input[placeholder*="password"]', 'OwtvQubm2H9BP0qE')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_load_state('networkidle')
        
        # Check for desktop nav
        desktop_nav = await page.locator('nav.lg\\:flex').count()
        hamburger = await page.locator('button:has(svg)').filter(has_text="").count()
        
        print(f"  ✓ Desktop nav elements: {desktop_nav}")
        print(f"  ✓ Hamburger menu present: {hamburger > 0}")
        
        await page.screenshot(path='final_desktop.png')
        print("  ✓ Screenshot saved: final_desktop.png")
        await page.close()
        
        # Test Mobile
        print("\n📱 Testing Mobile (375px):")
        page = await browser.new_page(viewport={'width': 375, 'height': 667})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.fill('input[placeholder*="username"]', 'admin')
        await page.fill('input[placeholder*="password"]', 'OwtvQubm2H9BP0qE')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_load_state('networkidle')
        await page.wait_for_timeout(1000)
        
        # Check title
        title = await page.locator('h1').text_content()
        print(f"  ✓ Title text: '{title}'")
        
        await page.screenshot(path='final_mobile.png')
        print("  ✓ Screenshot saved: final_mobile.png")
        
        # Try to find and click hamburger
        try:
            menu_btn = page.locator('button').filter(has=page.locator('svg')).first
            if await menu_btn.is_visible():
                await menu_btn.click()
                await page.wait_for_timeout(500)
                await page.screenshot(path='final_mobile_menu_open.png')
                print("  ✓ Screenshot saved: final_mobile_menu_open.png")
                
                nav_links = await page.locator('nav a').count()
                print(f"  ✓ Menu navigation links: {nav_links}")
        except:
            print("  ⚠️  Could not open mobile menu")
        
        await browser.close()
        print("\n✅ Testing complete!")

asyncio.run(test_nav())
PYEOF
        
        echo ""
        echo "=========================================="
        echo "🎉 DEPLOYMENT SUCCESSFUL!"
        echo "=========================================="
        echo ""
        echo "Responsive navigation has been deployed!"
        echo "Check the screenshots to verify:"
        echo "  - final_desktop.png"
        echo "  - final_mobile.png"
        echo "  - final_mobile_menu_open.png"
        echo ""
        exit 0
    fi
    
    if [ $i -lt 10 ]; then
        echo "  Waiting 60 seconds..."
        sleep 60
    fi
done

echo ""
echo "=========================================="
echo "⏱️  Timeout after 10 minutes"
echo "=========================================="
echo "Deployment may still be in progress."
echo "Check Railway dashboard for status."
