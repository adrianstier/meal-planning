#!/usr/bin/env python3
"""Check deployment status and take screenshots"""
import asyncio
from playwright.async_api import async_playwright
import os

async def check_deployment():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        print("🔍 Checking Railway Deployment Status")
        print("=" * 60)
        
        # Check what's currently deployed
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        
        try:
            await page.goto('https://web-production-09493.up.railway.app/', timeout=10000)
            await page.wait_for_load_state('networkidle', timeout=10000)
            
            # Take screenshot
            await page.screenshot(path='deployment_desktop.png', full_page=True)
            print("✓ Took screenshot: deployment_desktop.png")
            
            # Check page title
            title = await page.title()
            print(f"✓ Page title: {title}")
            
            # Check if it's the login page or main app
            login_form = page.locator('form:has(input[type="password"])')
            has_login = await login_form.count() > 0
            print(f"✓ Login page: {has_login}")
            
            # Check for header
            header = page.locator('header')
            has_header = await header.count() > 0
            print(f"✓ Header found: {has_header}")
            
            if has_header:
                # Get header HTML
                header_html = await header.inner_html()
                print(f"✓ Header contains {len(header_html)} characters")
                
                # Check for specific elements
                has_nav = 'nav' in header_html.lower()
                has_menu_icon = 'lucide-menu' in header_html.lower() or 'menu' in header_html.lower()
                has_title = 'meal planner' in header_html.lower()
                
                print(f"  - Has nav element: {has_nav}")
                print(f"  - Has menu icon: {has_menu_icon}")
                print(f"  - Has title: {has_title}")
            
            # Check JavaScript bundle
            scripts = await page.locator('script[src*="static/js/main"]').all()
            if scripts:
                for script in scripts:
                    src = await script.get_attribute('src')
                    print(f"✓ JS bundle: {src}")
            else:
                print("⚠️  No JS bundle found")
            
            # Get current URL (might redirect)
            current_url = page.url
            print(f"✓ Current URL: {current_url}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await page.screenshot(path='deployment_error.png')
            print("✓ Took error screenshot: deployment_error.png")
        
        # Mobile view
        print("\n" + "-" * 60)
        print("📱 Mobile View")
        print("-" * 60)
        
        page2 = await browser.new_page(viewport={'width': 375, 'height': 667})
        try:
            await page2.goto('https://web-production-09493.up.railway.app/', timeout=10000)
            await page2.wait_for_load_state('networkidle', timeout=10000)
            
            await page2.screenshot(path='deployment_mobile.png', full_page=True)
            print("✓ Took screenshot: deployment_mobile.png")
            
        except Exception as e:
            print(f"❌ Error: {e}")
        
        await browser.close()
        
        print("\n" + "=" * 60)
        print("Screenshots saved - check them to see current state")
        print("=" * 60)

if __name__ == '__main__':
    asyncio.run(check_deployment())
