#!/usr/bin/env python3
"""
Recipe URL Scraper using recipe-scrapers library
Supports 100+ recipe websites with image downloading
"""

import os
import uuid
import requests
import ssl
import urllib.request
from urllib.parse import urlparse
from typing import Dict, Optional
from recipe_scrapers import scrape_me
from PIL import Image
from io import BytesIO

# Disable SSL verification for macOS certificate issues
# TODO: Fix SSL certificates for production
ssl._create_default_https_context = ssl._create_unverified_context


class RecipeURLScraper:
    """Scrape recipes from URLs and download images"""

    # Supported cuisine types
    CUISINES = [
        'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian',
        'French', 'Greek', 'Spanish', 'Korean', 'Vietnamese', 'American',
        'Mediterranean', 'Middle Eastern', 'Caribbean', 'German', 'British'
    ]

    def __init__(self, image_folder='static/recipe_images'):
        self.image_folder = image_folder
        os.makedirs(image_folder, exist_ok=True)

    def download_image(self, image_url: str) -> Optional[str]:
        """
        Download recipe image and save to local storage
        Returns relative path to saved image or None if failed
        """
        try:
            # Download image
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

            # Return relative path for web access
            return f"/static/recipe_images/{filename}"

        except Exception as e:
            print(f"⚠️  Failed to download image from {image_url}: {e}")
            return None

    def scrape_recipe(self, url: str) -> Dict:
        """
        Scrape recipe from URL using recipe-scrapers library
        Returns structured recipe data
        """
        try:
            scraper = scrape_me(url)

            # Extract all available data
            recipe_data = {
                'name': scraper.title(),
                'ingredients': self._format_ingredients(scraper.ingredients()),
                'instructions': self._format_instructions(scraper.instructions()),
                'cook_time_minutes': self._parse_time(scraper.total_time()),
                'servings': self._parse_yields(scraper.yields()),
            }

            # Optional fields
            try:
                recipe_data['tags'] = ', '.join(scraper.category().split() if scraper.category() else [])
            except:
                recipe_data['tags'] = ''

            # Extract and normalize cuisine
            try:
                cuisine = scraper.cuisine()
                if cuisine:
                    normalized_cuisine = self._normalize_cuisine(cuisine)
                    recipe_data['cuisine'] = normalized_cuisine
                    # Also add to tags if not already there
                    if normalized_cuisine and recipe_data['tags']:
                        if normalized_cuisine.lower() not in recipe_data['tags'].lower():
                            recipe_data['tags'] += f", {normalized_cuisine}"
                    elif normalized_cuisine:
                        recipe_data['tags'] = normalized_cuisine
            except:
                pass

            # Download and save image
            try:
                image_url = scraper.image()
                if image_url:
                    image_path = self.download_image(image_url)
                    if image_path:
                        recipe_data['image_url'] = image_path
            except Exception as e:
                print(f"⚠️  Could not extract/download image: {e}")

            return recipe_data

        except Exception as e:
            raise Exception(f"Failed to scrape recipe: {str(e)}")

    def _format_ingredients(self, ingredients: list) -> str:
        """Format ingredients list as text"""
        return '\n'.join(ingredients) if ingredients else ''

    def _format_instructions(self, instructions: str) -> str:
        """Format instructions text"""
        if not instructions:
            return ''

        # Clean up common formatting issues
        instructions = instructions.strip()

        # If it's already well-formatted, return as-is
        return instructions

    def _parse_time(self, time_minutes: int) -> Optional[int]:
        """Parse time to minutes"""
        try:
            return int(time_minutes) if time_minutes else None
        except:
            return None

    def _parse_yields(self, yields_str: str) -> Optional[int]:
        """Parse servings/yields string to number"""
        try:
            # Extract first number from string like "4 servings" or "Makes 6"
            import re
            match = re.search(r'(\d+)', str(yields_str))
            return int(match.group(1)) if match else None
        except:
            return None

    def _normalize_cuisine(self, cuisine_str: str) -> Optional[str]:
        """Normalize cuisine string to standard cuisine types"""
        if not cuisine_str:
            return None

        cuisine_lower = cuisine_str.lower()

        # Check for exact or partial matches with our cuisine list
        for standard_cuisine in self.CUISINES:
            if standard_cuisine.lower() in cuisine_lower or cuisine_lower in standard_cuisine.lower():
                return standard_cuisine

        # Special mappings for common variations
        mappings = {
            'asian': 'Asian',
            'mexican': 'Mexican',
            'tex-mex': 'Mexican',
            'italian': 'Italian',
            'japanese': 'Japanese',
            'sushi': 'Japanese',
            'chinese': 'Chinese',
            'thai': 'Thai',
            'indian': 'Indian',
            'curry': 'Indian',
            'french': 'French',
            'greek': 'Greek',
            'mediterranean': 'Mediterranean',
            'middle eastern': 'Middle Eastern',
            'spanish': 'Spanish',
            'korean': 'Korean',
            'vietnamese': 'Vietnamese',
            'american': 'American',
            'southern': 'American',
            'bbq': 'American',
            'barbecue': 'American',
        }

        for key, value in mappings.items():
            if key in cuisine_lower:
                return value

        # Return capitalized original if no match found
        return cuisine_str.title()


# Supported sites (just a sample - recipe-scrapers supports 100+)
SUPPORTED_SITES = [
    'allrecipes.com',
    'foodnetwork.com',
    'bonappetit.com',
    'epicurious.com',
    'seriouseats.com',
    'budgetbytes.com',
    'minimalistbaker.com',
    'thekitchn.com',
    'tasteofhome.com',
    'delish.com',
    'cooking.nytimes.com',
    'simplyrecipes.com',
    'bbcgoodfood.com',
    'jamieoliver.com',
    'recipetineats.com',
]


if __name__ == '__main__':
    # Test with a sample recipe
    scraper = RecipeURLScraper()

    test_url = "https://www.allrecipes.com/recipe/12151/banana-banana-bread/"

    print(f"Testing with: {test_url}")
    try:
        data = scraper.scrape_recipe(test_url)
        print("\n✅ Successfully scraped recipe:")
        print(f"Name: {data['name']}")
        print(f"Servings: {data.get('servings')}")
        print(f"Cook time: {data.get('cook_time_minutes')} minutes")
        print(f"Image: {data.get('image_url', 'No image')}")
        print(f"Ingredients count: {len(data['ingredients'].split(chr(10)))}")
        print(f"Tags: {data.get('tags')}")
    except Exception as e:
        print(f"❌ Failed: {e}")
