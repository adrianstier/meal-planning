/**
 * Utility functions for scaling ingredient quantities
 */

// Convert fractions to decimals
const fractionToDecimal = (fraction: string): number => {
  const fractionMap: { [key: string]: number } = {
    '¼': 0.25,
    '½': 0.5,
    '¾': 0.75,
    '⅓': 0.333,
    '⅔': 0.667,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
    '1/4': 0.25,
    '1/2': 0.5,
    '3/4': 0.75,
    '1/3': 0.333,
    '2/3': 0.667,
    '1/8': 0.125,
    '3/8': 0.375,
    '5/8': 0.625,
    '7/8': 0.875,
  };
  return fractionMap[fraction] || 0;
};

// Convert decimal to mixed fraction string
const decimalToFraction = (decimal: number): string => {
  const whole = Math.floor(decimal);
  const remainder = decimal - whole;

  // Common fractions mapping
  const fractionMap: { [key: number]: string } = {
    0.125: '⅛',
    0.25: '¼',
    0.333: '⅓',
    0.375: '⅜',
    0.5: '½',
    0.625: '⅝',
    0.667: '⅔',
    0.75: '¾',
    0.875: '⅞',
  };

  // Find closest fraction
  let closestFraction = '';
  let minDiff = Infinity;

  Object.entries(fractionMap).forEach(([dec, frac]) => {
    const diff = Math.abs(parseFloat(dec) - remainder);
    if (diff < minDiff && diff < 0.05) {
      minDiff = diff;
      closestFraction = frac;
    }
  });

  if (closestFraction) {
    return whole > 0 ? `${whole} ${closestFraction}` : closestFraction;
  }

  // If no close fraction found, use decimal
  return decimal.toFixed(2).replace(/\.?0+$/, '');
};

/**
 * Scale a single ingredient line by the given multiplier
 */
export const scaleIngredient = (ingredientLine: string, multiplier: number): string => {
  // Try to find a quantity at the start of the line.
  // Handles: "1 1/2 cups", "1½ cups", "1/2 cup", "½ cup", "2 cups", etc.
  // Strategy: try patterns from most specific to least specific to avoid
  // the bug where "1/2" was split into whole=1 + fraction="/2" (which maps to 0).

  let originalQuantity = 0;
  let matchLength = 0;

  // Pattern 1: whole number + space + slash fraction (e.g., "1 1/2")
  const mixedSlashMatch = ingredientLine.match(/^(\d+)\s+(\d+\/\d+)\s*/);
  // Pattern 2: whole number + unicode fraction, no space required (e.g., "1½" or "1 ½")
  const mixedUnicodeMatch = ingredientLine.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])\s*/);
  // Pattern 3: standalone slash fraction (e.g., "1/2")
  const slashFractionMatch = ingredientLine.match(/^(\d+\/\d+)\s*/);
  // Pattern 4: standalone unicode fraction (e.g., "½")
  const unicodeFractionMatch = ingredientLine.match(/^([¼½¾⅓⅔⅛⅜⅝⅞])\s*/);
  // Pattern 5: plain number (e.g., "2")
  const plainNumberMatch = ingredientLine.match(/^(\d+)\s*/);

  if (mixedSlashMatch) {
    originalQuantity = parseInt(mixedSlashMatch[1]) + fractionToDecimal(mixedSlashMatch[2]);
    matchLength = mixedSlashMatch[0].length;
  } else if (mixedUnicodeMatch) {
    originalQuantity = parseInt(mixedUnicodeMatch[1]) + fractionToDecimal(mixedUnicodeMatch[2]);
    matchLength = mixedUnicodeMatch[0].length;
  } else if (slashFractionMatch) {
    originalQuantity = fractionToDecimal(slashFractionMatch[1]);
    matchLength = slashFractionMatch[0].length;
  } else if (unicodeFractionMatch) {
    originalQuantity = fractionToDecimal(unicodeFractionMatch[1]);
    matchLength = unicodeFractionMatch[0].length;
  } else if (plainNumberMatch) {
    originalQuantity = parseInt(plainNumberMatch[1]);
    matchLength = plainNumberMatch[0].length;
  }

  // If no quantity found, return as-is
  if (originalQuantity === 0) {
    return ingredientLine;
  }

  const restOfLine = ingredientLine.slice(matchLength);

  // Scale the quantity
  const scaledQuantity = originalQuantity * multiplier;

  // Format the scaled quantity
  const formattedQuantity = decimalToFraction(scaledQuantity);

  return `${formattedQuantity} ${restOfLine}`;
};

/**
 * Scale all ingredients in a multi-line string
 */
export const scaleIngredients = (ingredients: string, multiplier: number): string => {
  const lines = ingredients.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line; // Preserve empty lines
    return scaleIngredient(trimmed, multiplier);
  }).join('\n');
};

/**
 * Calculate multiplier based on original and desired servings
 */
export const calculateServingMultiplier = (
  originalServings: number,
  desiredServings: number
): number => {
  // Guard against invalid inputs that could cause division by zero or negative multipliers
  if (originalServings <= 0 || desiredServings <= 0) return 1;
  return desiredServings / originalServings;
};
