#!/usr/bin/env python3
"""Test the recipe image scraper API"""

import requests

# First login to get a session
login_resp = requests.post('http://localhost:5001/api/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})

print(f"Login: {login_resp.status_code}")

if login_resp.ok:
    session = login_resp.cookies

    # Test URL parsing
    test_url = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"

    parse_resp = requests.post('http://localhost:5001/api/meals/parse',
        json={'recipe_text': test_url},
        cookies=session
    )

    print(f"\nParse API response: {parse_resp.status_code}")
    print(f"Response: {parse_resp.text[:500]}")

    if parse_resp.ok:
        data = parse_resp.json()
        if data.get('success'):
            recipe_data = data.get('data', {})
            print(f"\n✅ Successfully parsed!")
            print(f"Name: {recipe_data.get('name')}")
            print(f"Image URL: {recipe_data.get('image_url')}")
        else:
            print(f"\n❌ Parse failed: {data.get('error')}")
else:
    print(f"Login failed: {login_resp.text}")
