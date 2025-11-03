#!/usr/bin/env python3
"""Test responsive navigation menu using Playwright"""
import asyncio
from playwright.async_api import async_playwright

async def test_responsive_menu():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        print("🧪 Testing Responsive Navigation Menu")
        print("=" * 60)
        
        # Test 1: Desktop view (1280px)
        print("\n📱 Test 1: Desktop View (1280px)")
        print("-" * 60)
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.wait_for_load_state('networkidle')
        
        # Check if desktop nav is visible
        desktop_nav = page.locator('nav.hidden.lg\\:flex')
        is_visible = await desktop_nav.is_visible()
        print(f"✓ Desktop navigation visible: {is_visible}")
        
        # Check if hamburger menu is hidden
        hamburger = page.locator('button:has(svg.lucide-menu)')
        is_hidden = not await hamburger.is_visible()
        print(f"✓ Hamburger menu hidden: {is_hidden}")
        
        # Check nav items count
        nav_items = await page.locator('nav.hidden.lg\\:flex a').count()
        print(f"✓ Navigation items: {nav_items} (expected 6)")
        
        await page.close()
        
        # Test 2: Tablet view (768px)
        print("\n📱 Test 2: Tablet View (768px)")
        print("-" * 60)
        page = await browser.new_page(viewport={'width': 768, 'height': 1024})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.wait_for_load_state('networkidle')
        
        # Check if desktop nav is hidden
        desktop_nav = page.locator('nav.hidden.lg\\:flex')
        is_hidden = not await desktop_nav.is_visible()
        print(f"✓ Desktop navigation hidden: {is_hidden}")
        
        # Check if hamburger menu is visible
        hamburger = page.locator('button:has(svg.lucide-menu)')
        is_visible = await hamburger.is_visible()
        print(f"✓ Hamburger menu visible: {is_visible}")
        
        # Click hamburger menu
        await hamburger.click()
        await page.wait_for_timeout(500)
        
        # Check if dropdown menu appeared
        dropdown = page.locator('div.lg\\:hidden.border-t')
        is_visible = await dropdown.is_visible()
        print(f"✓ Dropdown menu opened: {is_visible}")
        
        # Check dropdown nav items
        dropdown_items = await page.locator('div.lg\\:hidden.border-t a').count()
        print(f"✓ Dropdown items: {dropdown_items} (expected 6)")
        
        # Check if X icon is shown (menu is open)
        x_icon = page.locator('button:has(svg.lucide-x)')
        x_visible = await x_icon.is_visible()
        print(f"✓ X icon visible (menu open): {x_visible}")
        
        await page.close()
        
        # Test 3: Mobile view (375px)
        print("\n📱 Test 3: Mobile View (375px)")
        print("-" * 60)
        page = await browser.new_page(viewport={'width': 375, 'height': 667})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.wait_for_load_state('networkidle')
        
        # Check title text
        title_full = page.locator('h1 span.hidden.sm\\:inline')
        title_short = page.locator('h1 span.sm\\:hidden')
        
        full_visible = await title_full.is_visible()
        short_visible = await title_short.is_visible()
        print(f"✓ Full title hidden: {not full_visible}")
        print(f"✓ Short title visible: {short_visible}")
        
        if short_visible:
            short_text = await title_short.text_content()
            print(f"✓ Short title text: '{short_text}' (expected 'Meal Planner')")
        
        # Check hamburger menu
        hamburger = page.locator('button:has(svg.lucide-menu)')
        is_visible = await hamburger.is_visible()
        print(f"✓ Hamburger menu visible: {is_visible}")
        
        # Test menu interaction
        await hamburger.click()
        await page.wait_for_timeout(500)
        
        dropdown = page.locator('div.lg\\:hidden.border-t')
        is_visible = await dropdown.is_visible()
        print(f"✓ Dropdown menu opened: {is_visible}")
        
        # Click a nav item to test menu closure
        first_item = page.locator('div.lg\\:hidden.border-t a').first
        await first_item.click()
        await page.wait_for_timeout(500)
        
        # Menu should close after clicking item
        is_hidden = not await dropdown.is_visible()
        print(f"✓ Menu closes after navigation: {is_hidden}")
        
        await page.close()
        
        # Test 4: Header responsiveness
        print("\n📱 Test 4: Header Height Responsiveness")
        print("-" * 60)
        
        # Mobile header height
        page = await browser.new_page(viewport={'width': 375, 'height': 667})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.wait_for_load_state('networkidle')
        
        header = page.locator('header')
        header_box = await header.bounding_box()
        mobile_height = header_box['height'] if header_box else 0
        print(f"✓ Mobile header height: {mobile_height}px")
        
        await page.close()
        
        # Desktop header height
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})
        await page.goto('https://web-production-09493.up.railway.app/')
        await page.wait_for_load_state('networkidle')
        
        header = page.locator('header')
        header_box = await header.bounding_box()
        desktop_height = header_box['height'] if header_box else 0
        print(f"✓ Desktop header height: {desktop_height}px")
        
        await page.close()
        await browser.close()
        
        # Summary
        print("\n" + "=" * 60)
        print("✅ Responsive Navigation Testing Complete!")
        print("=" * 60)

if __name__ == '__main__':
    asyncio.run(test_responsive_menu())
