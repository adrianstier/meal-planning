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
import json
import re
from urllib.parse import urlparse
from typing import Dict, Optional, List
from recipe_scrapers import scrape_me
from PIL import Image
from io import BytesIO

# Optional BeautifulSoup for comment extraction
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

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
                'source_url': url,  # Save the original recipe URL
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

            # Extract top comments from recipe page
            try:
                comments = self._extract_comments(url)
                if comments:
                    recipe_data['top_comments'] = json.dumps(comments)
            except Exception as e:
                print(f"⚠️  Could not extract comments: {e}")

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

    def _extract_comments(self, url: str) -> List[Dict]:
        """
        Extract top 3 upvoted comments from recipe page
        Returns list of comment dicts with text and upvotes
        """
        if not HAS_BS4:
            print("⚠️  BeautifulSoup not available - skipping comment extraction")
            return []

        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            comments = []

            # Try different comment extraction strategies based on site

            # Strategy 1: AllRecipes-style comments (most common)
            comment_sections = soup.find_all(['div', 'article', 'li'],
                class_=re.compile(r'comment|review|user-comment', re.I))

            for section in comment_sections[:10]:  # Check first 10 potential comments
                # Extract comment text
                text_elem = section.find(['p', 'div', 'span'],
                    class_=re.compile(r'comment.*text|review.*text|user.*text|body', re.I))

                if not text_elem:
                    # Fallback: get all text from section
                    text_elem = section

                comment_text = text_elem.get_text(strip=True) if text_elem else ''

                # Filter out short/empty comments
                if len(comment_text) < 20 or len(comment_text) > 500:
                    continue

                # Try to extract upvote/like count
                upvotes = 0
                upvote_elem = section.find(['span', 'div', 'button'],
                    class_=re.compile(r'helpful|upvote|like|vote|rating', re.I))

                if upvote_elem:
                    upvote_text = upvote_elem.get_text(strip=True)
                    # Extract number from text like "42 helpful" or "Helpful (15)"
                    numbers = re.findall(r'\d+', upvote_text)
                    if numbers:
                        upvotes = int(numbers[0])

                comments.append({
                    'text': comment_text,
                    'upvotes': upvotes
                })

            # Sort by upvotes (descending) and take top 3
            comments = sorted(comments, key=lambda x: x['upvotes'], reverse=True)[:3]

            if comments:
                print(f"✅ Extracted {len(comments)} top comments")

            return comments

        except Exception as e:
            print(f"⚠️  Failed to extract comments: {e}")
            return []


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

    test_url = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"

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
