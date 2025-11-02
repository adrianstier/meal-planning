#!/usr/bin/env python3
"""
AI-Powered Recipe Parser using Anthropic Claude API
Parses recipe URLs or text and extracts structured meal data
"""

import anthropic
import json
from typing import Dict, List, Optional
import re


class RecipeParser:
    """Parse recipes using Claude AI"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        # Use Claude 3 Haiku - fast and cost-effective for recipe parsing
        self.model = "claude-3-haiku-20240307"

    def parse_recipe(self, recipe_input: str) -> Dict:
        """
        Parse a recipe from text or URL
        Returns structured meal data
        """

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
                return self._validate_and_clean(parsed_data)
            else:
                raise ValueError("No JSON found in AI response")

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
