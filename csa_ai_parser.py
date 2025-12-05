"""
CSA Box AI Parser
Uses Claude AI to parse CSA box contents from text or photos
Extracts produce items with quantity, unit, and estimated shelf life
"""

import anthropic
import json
import base64
import re
from typing import Dict, List, Optional
from datetime import datetime


class CSABoxParser:
    """Parse CSA box contents using Claude AI"""

    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        # Use Haiku for fast text parsing
        self.text_model = "claude-3-5-haiku-20241022"
        # Use Sonnet for vision (better at image understanding)
        self.vision_model = "claude-sonnet-4-20250514"

    def parse_text(self, text: str, source: str = "CSA") -> Dict:
        """
        Parse CSA box contents from text description

        Args:
            text: Description of CSA box contents (list, email, newsletter, etc.)
            source: Source of the produce (e.g., "Green Valley Farm", "CSA")

        Returns:
            Dict with parsed produce items
        """
        prompt = f"""Parse the following text describing fresh produce from a CSA box, farmers market,
or grocery shopping trip. Extract all produce items with their quantities.

Text to parse:
{text}

Return a JSON object with this structure:
{{
    "items": [
        {{
            "name": "Tomatoes",
            "quantity": 4,
            "unit": "pieces",
            "estimated_shelf_life_days": 7,
            "notes": "optional notes like 'cherry tomatoes' or 'very ripe'"
        }}
    ],
    "source_detected": "name of farm or source if mentioned in text",
    "delivery_date_detected": "YYYY-MM-DD if a date is mentioned, otherwise null"
}}

Guidelines:
- Extract ALL produce items (vegetables, fruits, herbs)
- For quantity: use numbers (2, 0.5, etc.)
- For unit: use "bunch", "lb", "oz", "pieces", "head", "bag", "pint", etc.
- For shelf life, estimate based on produce type:
  - Leafy greens (lettuce, spinach): 5-7 days
  - Herbs (basil, cilantro, parsley): 5-10 days
  - Root vegetables (carrots, beets, potatoes): 14-21 days
  - Tomatoes: 5-7 days
  - Berries: 3-5 days
  - Apples, citrus: 14-30 days
  - Squash: 14-30 days
  - Onions, garlic: 30+ days
  - Peppers: 7-14 days
  - Cucumbers: 7-10 days
  - Corn: 3-5 days
  - Zucchini: 7-10 days
- If source/farm name is mentioned, include it in source_detected
- If a date is mentioned (delivery date, pickup date), include it

Return ONLY valid JSON, no other text."""

        try:
            message = self.client.messages.create(
                model=self.text_model,
                max_tokens=2000,
                timeout=30.0,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            response_text = message.content[0].text

            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
                return self._validate_and_enhance(parsed_data, source)
            else:
                raise ValueError("No JSON found in AI response")

        except anthropic.APITimeoutError:
            raise Exception("AI request timed out. Please try again.")
        except anthropic.APIConnectionError:
            raise Exception("Failed to connect to AI service.")
        except anthropic.RateLimitError:
            raise Exception("AI rate limit exceeded. Please try again later.")
        except anthropic.APIError as e:
            raise Exception(f"AI service error: {str(e)}")
        except json.JSONDecodeError:
            raise Exception("Failed to parse AI response.")
        except Exception as e:
            raise Exception(f"Failed to parse CSA box: {str(e)}")

    def parse_image(self, image_data: str, media_type: str = "image/jpeg", source: str = "CSA") -> Dict:
        """
        Parse CSA box contents from a photo using Claude Vision

        Args:
            image_data: Base64 encoded image data
            media_type: MIME type (image/jpeg, image/png, image/webp, image/gif)
            source: Source of the produce

        Returns:
            Dict with parsed produce items
        """
        prompt = """Look at this photo of fresh produce (CSA box, farmers market haul, grocery shopping).
Identify ALL the produce items you can see.

Return a JSON object with this structure:
{
    "items": [
        {
            "name": "Tomatoes",
            "quantity": 4,
            "unit": "pieces",
            "estimated_shelf_life_days": 7,
            "notes": "optional notes like 'cherry tomatoes' or 'very ripe'"
        }
    ],
    "source_detected": "name of farm if visible on packaging/labels",
    "confidence": "high|medium|low"
}

Guidelines:
- Identify ALL visible produce (vegetables, fruits, herbs)
- Estimate quantities from what you see
- For quantity: use numbers (2, 0.5, etc.)
- For unit: use "bunch", "lb", "pieces", "head", "bag", "pint", etc.
- For shelf life, estimate based on produce type and visible freshness
- If you see farm labels or packaging with names, include in source_detected
- Set confidence based on image clarity and visibility

Return ONLY valid JSON, no other text."""

        try:
            message = self.client.messages.create(
                model=self.vision_model,
                max_tokens=2000,
                timeout=60.0,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }]
            )

            response_text = message.content[0].text

            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                parsed_data = json.loads(json_match.group())
                return self._validate_and_enhance(parsed_data, source)
            else:
                raise ValueError("No JSON found in AI response")

        except anthropic.APITimeoutError:
            raise Exception("AI request timed out (image analysis takes longer). Please try again.")
        except anthropic.APIConnectionError:
            raise Exception("Failed to connect to AI service.")
        except anthropic.RateLimitError:
            raise Exception("AI rate limit exceeded. Please try again later.")
        except anthropic.APIError as e:
            raise Exception(f"AI service error: {str(e)}")
        except json.JSONDecodeError:
            raise Exception("Failed to parse AI response.")
        except Exception as e:
            raise Exception(f"Failed to parse CSA box image: {str(e)}")

    def _validate_and_enhance(self, data: Dict, default_source: str) -> Dict:
        """Validate and enhance parsed data"""

        # Ensure items array exists
        if 'items' not in data:
            data['items'] = []

        # Validate and clean each item
        validated_items = []
        for item in data['items']:
            if not item.get('name'):
                continue

            validated_item = {
                'name': item['name'].strip().title(),
                'quantity': item.get('quantity', 1),
                'unit': item.get('unit', 'pieces'),
                'estimated_shelf_life_days': item.get('estimated_shelf_life_days', 7),
                'notes': item.get('notes', '')
            }

            # Ensure quantity is a number
            try:
                validated_item['quantity'] = float(validated_item['quantity'])
            except (ValueError, TypeError):
                validated_item['quantity'] = 1

            # Ensure shelf life is reasonable
            shelf_life = validated_item['estimated_shelf_life_days']
            if not isinstance(shelf_life, (int, float)) or shelf_life < 1:
                validated_item['estimated_shelf_life_days'] = 7
            elif shelf_life > 60:
                validated_item['estimated_shelf_life_days'] = 60

            validated_items.append(validated_item)

        # Use detected source or default
        source = data.get('source_detected') or default_source

        # Parse delivery date if detected
        delivery_date = None
        if data.get('delivery_date_detected'):
            try:
                # Try to parse the date
                date_str = data['delivery_date_detected']
                delivery_date = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
            except (ValueError, TypeError):
                delivery_date = datetime.now().strftime('%Y-%m-%d')
        else:
            delivery_date = datetime.now().strftime('%Y-%m-%d')

        return {
            'items': validated_items,
            'source': source,
            'delivery_date': delivery_date,
            'confidence': data.get('confidence', 'medium'),
            'total_items': len(validated_items)
        }


def test_parser():
    """Test the CSA box parser"""
    import os
    from dotenv import load_dotenv

    load_dotenv()

    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        print("No API key found. Set ANTHROPIC_API_KEY in .env file")
        return

    parser = CSABoxParser(api_key)

    # Test with sample CSA box description
    sample_text = """
    This week's CSA box from Green Valley Farm (picked up December 3rd):
    - 2 bunches of kale
    - 1 lb carrots
    - 4 tomatoes (very ripe, use soon!)
    - 1 head lettuce
    - 1 bunch radishes
    - 2 zucchini
    - Fresh basil (small bunch)
    - 3 apples
    """

    print("Testing CSA Box AI Parser...")
    print("=" * 60)

    try:
        result = parser.parse_text(sample_text)
        print("Parsed successfully!")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_parser()
