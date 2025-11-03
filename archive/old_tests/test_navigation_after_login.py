#!/usr/bin/env python3
"""Test responsive navigation after login"""
import asyncio
from playwright.async_api import async_playwright

async def test_navigation():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        print("🧪 Testing Responsive Navigation (After Login)")
        print("=" * 60)
        
        # Test Desktop View
        print("\n📱 Test 1: Desktop View (1280px)")
        print("-" * 60)
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        
        # Login first
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.fill('input[placeholder*="username"]', 'admin')
        await page.fill('input[placeholder*="password"]', 'OwtvQubm2H9BP0qE')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_load_state('networkidle')
        
        # Take screenshot
        await page.screenshot(path='navigation_desktop.png', full_page=False)
        print("✓ Screenshot: navigation_desktop.png")
        
        # Check desktop navigation
        header = page.locator('header')
        has_header = await header.count() > 0
        print(f"✓ Header present: {has_header}")
        
        # Check for desktop nav
        desktop_nav = page.locator('nav.lg\\:flex')
        nav_visible = await desktop_nav.is_visible() if await desktop_nav.count() > 0 else False
        print(f"✓ Desktop nav visible: {nav_visible}")
        
        # Check nav items
        nav_links = await page.locator('nav.lg\\:flex a').count()
        print(f"✓ Desktop nav links: {nav_links}")
        
        # Check hamburger is hidden
        hamburger = page.locator('button:has(svg)')
        hamburger_count = await hamburger.count()
        print(f"✓ Hamburger buttons found: {hamburger_count}")
        
        await page.close()
        
        # Test Tablet View
        print("\n📱 Test 2: Tablet View (900px)")
        print("-" * 60)
        page = await browser.new_page(viewport={'width': 900, 'height': 1024})
        
        # Login
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.fill('input[placeholder*="username"]', 'admin')
        await page.fill('input[placeholder*="password"]', 'OwtvQubm2H9BP0qE')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_load_state('networkidle')
        await page.wait_for_timeout(1000)
        
        # Take screenshot
        await page.screenshot(path='navigation_tablet.png', full_page=False)
        print("✓ Screenshot: navigation_tablet.png")
        
        # Check for hamburger menu
        hamburger = page.locator('button').filter(has=page.locator('svg'))
        hamburger_count = await hamburger.count()
        print(f"✓ Buttons with SVG: {hamburger_count}")
        
        # Try to find and click hamburger
        menu_button = page.locator('button[class*="h-9 w-9"]').first
        if await menu_button.count() > 0:
            is_visible = await menu_button.is_visible()
            print(f"✓ Hamburger menu button visible: {is_visible}")
            
            if is_visible:
                await menu_button.click()
                await page.wait_for_timeout(500)
                
                # Take screenshot of opened menu
                await page.screenshot(path='navigation_tablet_open.png', full_page=False)
                print("✓ Screenshot: navigation_tablet_open.png")
                
                # Check for dropdown
                dropdown_links = await page.locator('nav a').count()
                print(f"✓ Dropdown navigation links: {dropdown_links}")
        
        await page.close()
        
        # Test Mobile View
        print("\n📱 Test 3: Mobile View (375px)")
        print("-" * 60)
        page = await browser.new_page(viewport={'width': 375, 'height': 667})
        
        # Login
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.fill('input[placeholder*="username"]', 'admin')
        await page.fill('input[placeholder*="password"]', 'OwtvQubm2H9BP0qE')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_load_state('networkidle')
        await page.wait_for_timeout(1000)
        
        # Take screenshot
        await page.screenshot(path='navigation_mobile.png', full_page=False)
        print("✓ Screenshot: navigation_mobile.png")
        
        # Check title
        title = await page.locator('h1').text_content()
        print(f"✓ Header title: '{title}'")
        
        # Check for hamburger and click it
        menu_button = page.locator('button[class*="h-9 w-9"]').first
        if await menu_button.count() > 0:
            is_visible = await menu_button.is_visible()
            print(f"✓ Hamburger menu button visible: {is_visible}")
            
            if is_visible:
                await menu_button.click()
                await page.wait_for_timeout(500)
                
                # Take screenshot of opened menu
                await page.screenshot(path='navigation_mobile_open.png', full_page=True)
                print("✓ Screenshot: navigation_mobile_open.png")
                
                # Check dropdown items
                dropdown_links = await page.locator('nav a').count()
                print(f"✓ Dropdown navigation links: {dropdown_links}")
        
        await page.close()
        await browser.close()
        
        print("\n" + "=" * 60)
        print("✅ Testing Complete!")
        print("Check the screenshots to see the responsive navigation")
        print("=" * 60)

if __name__ == '__main__':
    asyncio.run(test_navigation())
