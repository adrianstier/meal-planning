#!/bin/bash
echo "=========================================="
echo "Checking Bento Integration Deployment"
echo "=========================================="
echo ""

# Get current bundle hash
BUNDLE=$(curl -s "https://web-production-09493.up.railway.app/" 2>/dev/null | grep -o 'static/js/main\.[^"]*\.js' | head -1)
echo "Current bundle: $BUNDLE"
echo ""

# Run Playwright check
python3 << 'PYEOF'
import asyncio
from playwright.async_api import async_playwright

async def check_features():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        try:
            # Login
            print("Logging in...")
            await page.goto('https://web-production-09493.up.railway.app/')
            await page.fill('input[placeholder*="username"]', 'admin')
            await page.fill('input[placeholder*="password"]', 'OwtvQubm2H9BP0qE')
            await page.click('button:has-text("Sign In")')
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            # Check Bento Page
            print("\n📦 Checking Bento Page...")
            await page.goto('https://web-production-09493.up.railway.app/bento')
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            quick_add = await page.locator('text=Quick Add Common Items').count()
            protein_section = await page.locator('text=Protein').count()
            turkey_item = await page.locator('text=Turkey roll-ups').count()
            
            print(f"  Quick Add section: {'✅ FOUND' if quick_add > 0 else '❌ NOT FOUND'}")
            print(f"  Protein category: {'✅ FOUND' if protein_section > 0 else '❌ NOT FOUND'}")
            print(f"  Sample item (Turkey): {'✅ FOUND' if turkey_item > 0 else '❌ NOT FOUND'}")
            
            # Check Plan Page
            print("\n📅 Checking Plan Page...")
            await page.goto('https://web-production-09493.up.railway.app/plan')
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            bento_checkbox = await page.locator('text=Generate bento box lunches').count()
            
            print(f"  Bento generation option: {'✅ FOUND' if bento_checkbox > 0 else '❌ NOT FOUND'}")
            
            # Summary
            print("\n" + "="*40)
            if quick_add > 0 and bento_checkbox > 0:
                print("✅ BENTO INTEGRATION DEPLOYED SUCCESSFULLY!")
                print("="*40)
                print("\nAll features are now available:")
                print("  • Quick Add on Bento page")
                print("  • Bento generation on Plan page")
            else:
                print("⏳ DEPLOYMENT NOT YET COMPLETE")
                print("="*40)
                print("\nMissing features:")
                if quick_add == 0:
                    print("  • Quick Add section")
                if bento_checkbox == 0:
                    print("  • Bento generation checkbox")
                    
        except Exception as e:
            print(f"\n❌ Error: {e}")
        finally:
            await browser.close()

asyncio.run(check_features())
PYEOF

echo ""
