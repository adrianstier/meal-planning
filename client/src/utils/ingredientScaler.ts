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
  // Try to find numbers at the start of the line (with optional fractions)
  const numberPattern = /^(\d+\s*)?([¼½¾⅓⅔⅛⅜⅝⅞]|[\d\/]+)?\s*/;
  const match = ingredientLine.match(numberPattern);

  if (!match) {
    // No number found, return as-is
    return ingredientLine;
  }

  const wholeNumber = match[1] ? parseInt(match[1].trim()) : 0;
  const fractionPart = match[2] || '';
  const restOfLine = ingredientLine.slice(match[0].length);

  // Calculate original quantity
  let originalQuantity = wholeNumber;
  if (fractionPart) {
    originalQuantity += fractionToDecimal(fractionPart);
  }

  // If no quantity found, return as-is
  if (originalQuantity === 0 && !fractionPart) {
    return ingredientLine;
  }

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
  if (originalServings <= 0) return 1;
  return desiredServings / originalServings;
};
