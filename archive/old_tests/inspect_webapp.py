import asyncio
from playwright.async_api import async_playwright
import json

async def inspect_webapp():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        console_messages = []
        network_errors = []
        
        # Capture console messages
        page.on("console", lambda msg: console_messages.append({
            "type": msg.type,
            "text": msg.text
        }))
        
        # Capture network errors
        page.on("response", lambda response: 
            network_errors.append({
                "url": response.url,
                "status": response.status,
                "statusText": response.status_text
            }) if response.status >= 400 else None
        )
        
        print("Loading Railway app...")
        try:
            await page.goto("https://web-production-09493.up.railway.app/", wait_until="networkidle", timeout=30000)
            
            # Wait a bit for any async operations
            await page.wait_for_timeout(3000)
            
            # Get page title
            title = await page.title()
            print(f"\nPage Title: {title}")
            
            # Check if login page is visible
            login_form = await page.query_selector('form')
            if login_form:
                print("\n✅ Login form found")
                
                # Try to login
                print("\nAttempting login with admin credentials...")
                await page.fill('input[type="text"]', 'admin')
                await page.fill('input[type="password"]', 'OwtvQubm2H9BP0qE')
                await page.click('button[type="submit"]')
                
                # Wait for navigation or error
                await page.wait_for_timeout(5000)
                
                # Check current URL
                current_url = page.url
                print(f"\nCurrent URL after login: {current_url}")
                
                # Check for errors on page
                error_divs = await page.query_selector_all('[role="alert"], .error, [class*="error"]')
                if error_divs:
                    print(f"\nFound {len(error_divs)} error elements:")
                    for i, div in enumerate(error_divs):
                        text = await div.text_content()
                        print(f"  Error {i+1}: {text}")
            else:
                print("\n⚠️  No login form found")
            
            # Print console messages
            if console_messages:
                print(f"\nConsole Messages ({len(console_messages)}):")
                for msg in console_messages[-10:]:  # Last 10 messages
                    print(f"  [{msg['type']}] {msg['text']}")
            
            # Print network errors
            if network_errors:
                print(f"\nNetwork Errors ({len(network_errors)}):")
                for err in network_errors[-10:]:  # Last 10 errors
                    print(f"  {err['status']} {err['statusText']}: {err['url']}")
            
            # Take a screenshot
            await page.screenshot(path="railway_app_screenshot.png")
            print("\n📸 Screenshot saved to: railway_app_screenshot.png")
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
        
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_webapp())
