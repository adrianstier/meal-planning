"""
School Menu Vision Parser
Uses Claude's vision API to parse school cafeteria menu photos
"""

import anthropic
import base64
from typing import List, Dict
import json
from datetime import datetime


class SchoolMenuVisionParser:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-3-haiku-20240307"  # Claude 3 Haiku with vision (only available model)

    def parse_menu_from_image(self, image_data: bytes, image_type: str = "image/jpeg") -> List[Dict]:
        """
        Parse school menu from an image using Claude Vision

        Args:
            image_data: Raw image bytes
            image_type: MIME type (image/jpeg, image/png, image/webp)

        Returns:
            List of menu items with date, meal_name, meal_type, description
        """

        # Encode image to base64
        image_b64 = base64.standard_b64encode(image_data).decode("utf-8")

        prompt = """You are analyzing a school cafeteria menu. Please extract all the meals/food items and their dates.

For each meal, provide:
1. The date (in YYYY-MM-DD format, infer the year if not shown - use current/next month)
2. The meal name (e.g., "Pizza", "Chicken Nuggets", "Taco Tuesday")
3. The meal type (lunch, breakfast, or snack)
4. Any description or details (sides, ingredients, etc.)

Return ONLY a valid JSON array with this exact format:
[
  {
    "menu_date": "2025-11-04",
    "meal_name": "Pizza",
    "meal_type": "lunch",
    "description": "Cheese pizza with marinara sauce, side salad"
  },
  {
    "menu_date": "2025-11-05",
    "meal_name": "Chicken Nuggets",
    "meal_type": "lunch",
    "description": "With fries and vegetables"
  }
]

Important:
- Use YYYY-MM-DD date format
- If year is not shown, infer it based on the months shown (if showing November-December, use 2025)
- Extract ALL meals/items from the menu
- Be specific with meal names
- Include side dishes in description if mentioned
- Return ONLY the JSON array, no other text"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": image_type,
                                    "data": image_b64,
                                },
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ],
                    }
                ],
            )

            # Extract text response
            response_text = message.content[0].text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            response_text = response_text.strip()

            # Parse JSON
            menu_items = json.loads(response_text)

            # Validate structure
            if not isinstance(menu_items, list):
                raise ValueError("Response is not a list")

            # Ensure all items have required fields
            validated_items = []
            for item in menu_items:
                if 'menu_date' in item and 'meal_name' in item:
                    validated_items.append({
                        'menu_date': item['menu_date'],
                        'meal_name': item['meal_name'],
                        'meal_type': item.get('meal_type', 'lunch'),
                        'description': item.get('description', '')
                    })

            return validated_items

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Claude's response as JSON: {e}")
        except Exception as e:
            raise Exception(f"Vision API error: {str(e)}")

    def parse_menu_from_base64(self, base64_string: str, image_type: str = "image/jpeg") -> List[Dict]:
        """
        Parse menu from base64 encoded image string

        Args:
            base64_string: Base64 encoded image (without data:image prefix)
            image_type: MIME type

        Returns:
            List of menu items
        """
        image_data = base64.b64decode(base64_string)
        return self.parse_menu_from_image(image_data, image_type)
