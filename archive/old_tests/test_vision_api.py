#!/usr/bin/env python3
"""
Comprehensive test script for Claude Vision API
Tests different models and configurations
"""

import os
import anthropic
import base64
from dotenv import load_dotenv

# Load environment
load_dotenv()

def test_api_key():
    """Test API key is loaded correctly"""
    print("=" * 60)
    print("TEST 1: API Key Configuration")
    print("=" * 60)

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if api_key:
        print(f"✓ API key found (length: {len(api_key)})")
        print(f"✓ Starts with: {api_key[:10]}...")
        return api_key
    else:
        print("✗ No API key found!")
        return None

def test_anthropic_client(api_key):
    """Test Anthropic client initialization"""
    print("\n" + "=" * 60)
    print("TEST 2: Anthropic Client Initialization")
    print("=" * 60)

    try:
        client = anthropic.Anthropic(api_key=api_key)
        print("✓ Anthropic client created successfully")
        return client
    except Exception as e:
        print(f"✗ Failed to create client: {e}")
        return None

def test_available_models(client):
    """Test which Claude Vision models are available"""
    print("\n" + "=" * 60)
    print("TEST 3: Available Vision Models")
    print("=" * 60)

    # Create a simple test image (1x1 red pixel PNG)
    test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

    models_to_test = [
        "claude-3-5-sonnet-20240620",
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
    ]

    working_models = []

    for model in models_to_test:
        print(f"\nTesting model: {model}")
        try:
            message = client.messages.create(
                model=model,
                max_tokens=100,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": test_image_base64,
                                },
                            },
                            {
                                "type": "text",
                                "text": "What color is this?"
                            }
                        ],
                    }
                ],
            )
            print(f"  ✓ {model} - WORKS!")
            print(f"    Response: {message.content[0].text[:50]}...")
            working_models.append(model)
        except anthropic.NotFoundError as e:
            print(f"  ✗ {model} - NOT FOUND (404)")
        except Exception as e:
            print(f"  ✗ {model} - Error: {e}")

    print("\n" + "-" * 60)
    print(f"Working models: {len(working_models)}")
    for model in working_models:
        print(f"  • {model}")

    return working_models

def test_school_menu_parser(api_key):
    """Test the actual SchoolMenuVisionParser class"""
    print("\n" + "=" * 60)
    print("TEST 4: SchoolMenuVisionParser Class")
    print("=" * 60)

    try:
        from school_menu_vision_parser import SchoolMenuVisionParser

        parser = SchoolMenuVisionParser(api_key)
        print(f"✓ Parser created successfully")
        print(f"✓ Model being used: {parser.model}")

        # Create a simple test image
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        test_image_bytes = base64.b64decode(test_image_base64)

        print("\nAttempting to parse test image...")
        result = parser.parse_menu_from_image(test_image_bytes, "image/png")
        print(f"✓ Parse succeeded! Result: {result}")

        return True
    except Exception as e:
        print(f"✗ Parser test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_flask_endpoint():
    """Test the Flask API endpoint"""
    print("\n" + "=" * 60)
    print("TEST 5: Flask API Endpoint")
    print("=" * 60)

    import requests

    try:
        # Create a simple test image
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

        response = requests.post(
            'http://localhost:5001/api/school-menu/parse-photo',
            json={
                'image_data': f'data:image/png;base64,{test_image_base64}',
                'image_type': 'image/png',
                'auto_add': False
            },
            timeout=60
        )

        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")

        if response.status_code == 200:
            print("✓ API endpoint works!")
            return True
        else:
            print(f"✗ API endpoint returned error")
            return False

    except Exception as e:
        print(f"✗ API test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "=" * 60)
    print("🔍 CLAUDE VISION API COMPREHENSIVE TEST SUITE")
    print("=" * 60)

    # Test 1: API Key
    api_key = test_api_key()
    if not api_key:
        print("\n❌ Cannot continue without API key")
        return

    # Test 2: Client
    client = test_anthropic_client(api_key)
    if not client:
        print("\n❌ Cannot continue without client")
        return

    # Test 3: Available Models
    working_models = test_available_models(client)

    # Test 4: SchoolMenuVisionParser
    parser_works = test_school_menu_parser(api_key)

    # Test 5: Flask API
    flask_works = test_flask_endpoint()

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"API Key: {'✓' if api_key else '✗'}")
    print(f"Anthropic Client: {'✓' if client else '✗'}")
    print(f"Working Models: {len(working_models)}")
    print(f"SchoolMenuVisionParser: {'✓' if parser_works else '✗'}")
    print(f"Flask API: {'✓' if flask_works else '✗'}")

    if working_models:
        print("\n💡 Recommended model to use:")
        print(f"   {working_models[0]}")

if __name__ == "__main__":
    main()
