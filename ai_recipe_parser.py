#!/usr/bin/env python3
"""
AI-Powered Recipe Parser using Anthropic Claude API
Parses recipe URLs or text and extracts structured meal data
"""

import anthropic
import json
from typing import Dict, List, Optional
import re
import requests
import os
import uuid
from urllib.parse import urlparse, urljoin
from PIL import Image
from io import BytesIO

# Optional dependency for image extraction from URLs
try:
    from bs4 import BeautifulSoup
    HAS_BEAUTIFULSOUP = True
except ImportError:
    HAS_BEAUTIFULSOUP = False
    print("⚠️  BeautifulSoup not available - image extraction from URLs will be disabled")


class RecipeParser:
    """Parse recipes using Claude AI"""

    def __init__(self, api_key: str, image_folder='static/recipe_images'):
        self.client = anthropic.Anthropic(api_key=api_key)
        # Use Claude 3.5 Haiku - faster and more accurate than 3.0
        self.model = "claude-3-5-haiku-20241022"
        self.image_folder = image_folder
        os.makedirs(image_folder, exist_ok=True)

    def _is_url(self, text: str) -> bool:
        """Check if text is a URL"""
        return text.strip().startswith(('http://', 'https://'))

    def _extract_image_from_url(self, url: str) -> Optional[str]:
        """
        Extract and download the main recipe image from a URL
        Returns relative path to saved image or None
        """
        # Check if BeautifulSoup is available
        if not HAS_BEAUTIFULSOUP:
            print("⚠️  BeautifulSoup not installed - skipping image extraction from URL")
            return None

        try:
            # Fetch the webpage
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            # Parse HTML
            soup = BeautifulSoup(response.content, 'html.parser')

            # Try to find recipe image using common patterns
            image_url = None

            # Method 1: Look for og:image meta tag (most reliable)
            og_image = soup.find('meta', property='og:image')
            if og_image and og_image.get('content'):
                image_url = og_image['content']

            # Method 2: Look for schema.org Recipe image
            if not image_url:
                recipe_schema = soup.find('script', type='application/ld+json')
                if recipe_schema:
                    try:
                        schema_data = json.loads(recipe_schema.string)
                        if isinstance(schema_data, dict) and 'image' in schema_data:
                            img_data = schema_data['image']
                            if isinstance(img_data, str):
                                image_url = img_data
                            elif isinstance(img_data, list) and len(img_data) > 0:
                                image_url = img_data[0]
                            elif isinstance(img_data, dict) and 'url' in img_data:
                                image_url = img_data['url']
                    except:
                        pass

            # Method 3: Look for largest image in article/recipe content
            if not image_url:
                article = soup.find('article') or soup.find('div', class_=re.compile(r'recipe|content'))
                if article:
                    images = article.find_all('img')
                    if images:
                        # Get first image with reasonable size
                        for img in images:
                            src = img.get('src') or img.get('data-src')
                            if src and not any(x in src.lower() for x in ['icon', 'logo', 'avatar', 'ad']):
                                image_url = src
                                break

            if not image_url:
                print("⚠️  No recipe image found in URL")
                return None

            # Make URL absolute if relative
            if image_url.startswith('//'):
                image_url = 'https:' + image_url
            elif image_url.startswith('/'):
                parsed = urlparse(url)
                image_url = f"{parsed.scheme}://{parsed.netloc}{image_url}"
            elif not image_url.startswith('http'):
                image_url = urljoin(url, image_url)

            # Download and save the image
            return self._download_and_save_image(image_url)

        except Exception as e:
            print(f"⚠️  Failed to extract image from URL: {e}")
            return None

    def _download_and_save_image(self, image_url: str) -> Optional[str]:
        """
        Download image and save to local storage
        Returns relative path to saved image
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(image_url, headers=headers, timeout=10)
            response.raise_for_status()

            # Open and validate image
            img = Image.open(BytesIO(response.content))

            # Generate unique filename
            ext = os.path.splitext(urlparse(image_url).path)[1] or '.jpg'
            if ext.lower() not in ['.jpg', '.jpeg', '.png', '.webp']:
                ext = '.jpg'

            filename = f"{uuid.uuid4()}{ext}"
            filepath = os.path.join(self.image_folder, filename)

            # Convert RGBA to RGB if needed (for JPEG)
            if img.mode == 'RGBA' and ext.lower() in ['.jpg', '.jpeg']:
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[3])
                img = rgb_img

            # Resize if too large (max 1200px width)
            max_width = 1200
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            # Save image
            img.save(filepath, optimize=True, quality=85)

            print(f"✅ Downloaded recipe image: {filename} ({img.width}x{img.height})")

            # Return relative path for web access
            return f"/static/recipe_images/{filename}"

        except Exception as e:
            print(f"⚠️  Failed to download image: {e}")
            return None

    def parse_recipe(self, recipe_input: str) -> Dict:
        """
        Parse a recipe from text or URL
        Returns structured meal data with image if URL provided
        """

        # Check if input is a URL and try to extract image
        image_url = None
        source_url = None
        if self._is_url(recipe_input):
            source_url = recipe_input
            image_url = self._extract_image_from_url(recipe_input)

        prompt = f"""Parse the following recipe and extract structured information.

Recipe input:
{recipe_input}

Please analyze this recipe and provide a JSON response with the following structure:
{{
    "name": "Recipe name",
    "meal_type": "dinner|lunch|snack|breakfast",
    "cuisine": "Italian|Mexican|Chinese|Japanese|Thai|Indian|French|Greek|Spanish|Korean|Vietnamese|American|Mediterranean|Middle Eastern|Caribbean|German|British|Asian|Other",
    "kid_friendly_level": 1-10 (how kid-friendly is this meal),
    "prep_time_minutes": estimated prep time in minutes,
    "cook_time_minutes": estimated cook time in minutes,
    "adult_friendly": true|false,
    "dietary_category": "omnivore|vegetarian|pescatarian|vegan",
    "notes": "Any special notes or tips",
    "instructions": "Step-by-step cooking instructions as a single string with numbered steps",
    "ingredients": [
        {{
            "name": "ingredient name",
            "component_type": "protein|veggie|starch|fruit|condiment|side",
            "quantity": "amount (e.g., '2 cups', '1 lb')",
            "is_optional": true|false
        }}
    ]
}}

Guidelines:
- kid_friendly_level: Consider whether kids aged 4-7 would typically enjoy this
- meal_type: What meal this would typically be served as
- cuisine: Identify the cuisine type based on ingredients, cooking methods, and dish origin. Be specific (e.g., Italian for pasta, Mexican for tacos, Japanese for sushi)
- instructions: Extract and format cooking steps as a clear, numbered list. If no instructions are provided, write brief but complete step-by-step instructions based on typical cooking methods for this recipe.
- component_type: Classify each ingredient appropriately
  - protein: meat, fish, beans, eggs, cheese
  - veggie: vegetables
  - starch: pasta, rice, bread, potatoes
  - fruit: fruits
  - condiment: sauces, spices, oils
  - side: anything else

Return ONLY valid JSON, no other text."""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                timeout=30.0,  # Add 30 second timeout
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            # Extract JSON from response
            response_text = message.content[0].text

            # Try to find JSON in the response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
                cleaned_data = self._validate_and_clean(parsed_data)

                # Add image URL if we extracted one
                if image_url:
                    cleaned_data['image_url'] = image_url

                # Add source URL if this was from a URL
                if source_url:
                    cleaned_data['source_url'] = source_url

                return cleaned_data
            else:
                raise ValueError("No JSON found in AI response")

        except anthropic.APITimeoutError as e:
            raise Exception(f"AI request timed out after 30 seconds: {str(e)}")
        except anthropic.APIConnectionError as e:
            raise Exception(f"Failed to connect to AI service: {str(e)}")
        except anthropic.RateLimitError as e:
            raise Exception(f"AI rate limit exceeded. Please try again later: {str(e)}")
        except anthropic.APIError as e:
            raise Exception(f"AI service error: {str(e)}")
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse AI response as JSON: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to parse recipe: {str(e)}")

    def _validate_and_clean(self, data: Dict) -> Dict:
        """Validate and clean parsed data"""

        # Ensure required fields
        required = ['name', 'meal_type', 'kid_friendly_level',
                   'prep_time_minutes', 'cook_time_minutes']

        for field in required:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        # Set defaults
        if 'adult_friendly' not in data:
            data['adult_friendly'] = True

        if 'notes' not in data:
            data['notes'] = None

        if 'ingredients' not in data:
            data['ingredients'] = []

        # Validate meal_type
        valid_types = ['dinner', 'lunch', 'snack', 'breakfast']
        if data['meal_type'] not in valid_types:
            data['meal_type'] = 'dinner'

        # Validate kid_friendly_level
        data['kid_friendly_level'] = max(1, min(10, int(data['kid_friendly_level'])))

        # Validate ingredients
        valid_components = ['protein', 'veggie', 'starch', 'fruit', 'condiment', 'side']
        for ing in data['ingredients']:
            if 'component_type' not in ing:
                ing['component_type'] = 'side'
            elif ing['component_type'] not in valid_components:
                ing['component_type'] = 'side'

            if 'is_optional' not in ing:
                ing['is_optional'] = False

            if 'quantity' not in ing:
                ing['quantity'] = ''

        return data


def test_parser():
    """Test the recipe parser with a sample recipe"""
    import os
    from dotenv import load_dotenv

    load_dotenv()

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("❌ No API key found. Set ANTHROPIC_API_KEY in .env file")
        return

    parser = RecipeParser(api_key)

    # Test with sample recipe
    sample_recipe = """
    Chicken Tacos

    Ingredients:
    - 1 lb chicken breast, diced
    - 8 taco shells
    - 1 cup shredded cheese
    - 1 cup lettuce, shredded
    - 2 tomatoes, diced
    - 1/2 cup sour cream
    - Taco seasoning

    Instructions:
    1. Cook chicken with taco seasoning
    2. Warm taco shells
    3. Assemble tacos with chicken, cheese, lettuce, and tomatoes
    4. Top with sour cream

    Prep time: 10 minutes
    Cook time: 15 minutes
    """

    print("Testing AI Recipe Parser...")
    print("=" * 60)

    try:
        result = parser.parse_recipe(sample_recipe)
        print("✅ Parsed successfully!")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    test_parser()
