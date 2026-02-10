/**
 * Recipe Agent
 *
 * Specialized agent for recipe extraction, parsing, and validation.
 * Handles URL scraping, text parsing, image OCR, and recipe enrichment.
 */

import { BaseAgent } from './base-agent.ts'
import {
  AgentContext,
  AgentResponse,
  AgentTool,
  ToolResult,
  Recipe,
} from './types.ts'

export class RecipeAgent extends BaseAgent {
  constructor() {
    super(
      'recipe',
      'Extracts, parses, and validates recipes from URLs, text, or images',
      'claude-3-5-haiku-20241022'
    )
  }

  protected registerTools(): void {
    // Tool: Scrape URL
    this.registerTool({
      name: 'scrape_url',
      description: 'Fetch and extract content from a recipe URL',
      parameters: [
        {
          name: 'url',
          type: 'string',
          description: 'The URL to scrape',
          required: true,
        },
      ],
      execute: this.scrapeUrl.bind(this),
    })

    // Tool: Extract JSON-LD
    this.registerTool({
      name: 'extract_json_ld',
      description: 'Extract structured Recipe data from JSON-LD markup',
      parameters: [
        {
          name: 'html',
          type: 'string',
          description: 'The HTML content to parse',
          required: true,
        },
      ],
      execute: this.extractJsonLd.bind(this),
    })

    // Tool: Parse with AI
    this.registerTool({
      name: 'parse_with_ai',
      description: 'Use AI to parse unstructured recipe content',
      parameters: [
        {
          name: 'content',
          type: 'string',
          description: 'The raw recipe content (text or HTML)',
          required: true,
        },
        {
          name: 'source_type',
          type: 'string',
          description: 'Type of source: url, text, or image',
          required: true,
        },
      ],
      execute: this.parseWithAI.bind(this),
    })

    // Tool: Validate Recipe
    this.registerTool({
      name: 'validate_recipe',
      description: 'Validate a parsed recipe for completeness',
      parameters: [
        {
          name: 'recipe',
          type: 'object',
          description: 'The recipe object to validate',
          required: true,
        },
      ],
      execute: this.validateRecipe.bind(this),
    })

    // Tool: Estimate Nutrition
    this.registerTool({
      name: 'estimate_nutrition',
      description: 'Estimate nutritional values from ingredients',
      parameters: [
        {
          name: 'ingredients',
          type: 'string',
          description: 'The ingredients list',
          required: true,
        },
        {
          name: 'servings',
          type: 'number',
          description: 'Number of servings',
          required: true,
        },
      ],
      execute: this.estimateNutrition.bind(this),
    })
  }

  /**
   * Main processing logic for recipe agent
   */
  async process(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    // Check for URL in message
    const urlMatch = message.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i)

    if (urlMatch) {
      return this.processUrl(urlMatch[0], context)
    }

    // Check if it's a text recipe
    if (this.looksLikeRecipe(message)) {
      return this.processText(message, context)
    }

    // Check for image data
    if (message.includes('data:image/') || message.includes('base64')) {
      return this.processImage(message, context)
    }

    // General recipe question
    return this.handleRecipeQuestion(message, context)
  }

  /**
   * Process a recipe URL
   */
  private async processUrl(
    url: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log(`[RecipeAgent] Processing URL: ${url}`)

    // Step 1: Scrape the URL
    const scrapeResult = await this.executeTool('scrape_url', { url }, context)

    if (!scrapeResult.success) {
      return {
        success: false,
        message: `I couldn't fetch that recipe URL. ${scrapeResult.error}`,
        error: scrapeResult.error,
      }
    }

    const html = scrapeResult.data as string

    // Step 2: Try JSON-LD extraction first (cheaper, more reliable)
    const jsonLdResult = await this.executeTool(
      'extract_json_ld',
      { html },
      context
    )

    let recipe: Partial<Recipe>

    if (jsonLdResult.success && jsonLdResult.data) {
      console.log('[RecipeAgent] Successfully extracted JSON-LD')
      recipe = jsonLdResult.data as Partial<Recipe>
    } else {
      // Fall back to AI parsing
      console.log('[RecipeAgent] Falling back to AI parsing')
      const aiResult = await this.executeTool(
        'parse_with_ai',
        { content: html, source_type: 'url' },
        context
      )

      if (!aiResult.success) {
        return {
          success: false,
          message: `I couldn't parse the recipe from that URL. The page structure wasn't recognizable.`,
          error: aiResult.error,
        }
      }

      recipe = aiResult.data as Partial<Recipe>
    }

    // Step 3: Validate the recipe
    const validationResult = await this.executeTool(
      'validate_recipe',
      { recipe },
      context
    )

    if (!validationResult.success) {
      return {
        success: false,
        message: `I extracted some recipe data but it seems incomplete: ${validationResult.error}`,
        data: { partialRecipe: recipe },
      }
    }

    // Step 4: Estimate nutrition if missing
    if (!recipe.calories && recipe.ingredients) {
      const nutritionResult = await this.executeTool(
        'estimate_nutrition',
        {
          ingredients: recipe.ingredients,
          servings: recipe.servings || 4,
        },
        context
      )

      if (nutritionResult.success && nutritionResult.data) {
        const nutrition = nutritionResult.data as {
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
        }
        recipe = { ...recipe, ...nutrition }
      }
    }

    // Add source URL
    recipe.source_url = url

    return {
      success: true,
      message: `I've extracted "${recipe.name}" from that URL. It's a ${recipe.difficulty || 'medium'} ${recipe.cuisine || ''} recipe that serves ${recipe.servings || 4}.`,
      data: { recipe },
      actions: [
        {
          type: 'save_recipe',
          payload: { recipe },
        },
      ],
    }
  }

  /**
   * Process raw recipe text
   */
  private async processText(
    text: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[RecipeAgent] Processing text recipe')

    const aiResult = await this.executeTool(
      'parse_with_ai',
      { content: text, source_type: 'text' },
      context
    )

    if (!aiResult.success) {
      return {
        success: false,
        message: `I couldn't parse that recipe text. Could you try reformatting it?`,
        error: aiResult.error,
      }
    }

    const recipe = aiResult.data as Partial<Recipe>

    return {
      success: true,
      message: `I've parsed "${recipe.name}". It looks like a ${recipe.difficulty || 'medium'} difficulty ${recipe.meal_type || 'meal'}.`,
      data: { recipe },
      actions: [
        {
          type: 'save_recipe',
          payload: { recipe },
        },
      ],
    }
  }

  /**
   * Process recipe image
   */
  private async processImage(
    imageData: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[RecipeAgent] Processing image recipe')

    // Extract base64 data
    const base64Match = imageData.match(
      /data:image\/([a-z]+);base64,([A-Za-z0-9+/=]+)/
    )

    if (!base64Match) {
      return {
        success: false,
        message: `I couldn't process that image. Please make sure it's a valid image format.`,
      }
    }

    const mediaType = base64Match[1] as 'jpeg' | 'png' | 'gif' | 'webp'
    const base64Data = base64Match[2]

    // Use Claude Vision for OCR - must send image content block directly
    // since callAI() only supports text messages
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 4096,
          system: this.getRecipeParsingPrompt('image'),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: `image/${mediaType}`,
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: 'Please extract the recipe from this image.',
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[RecipeAgent] Vision API error (${response.status}): ${errorText.substring(0, 200)}`)
        throw new Error('AI service temporarily unavailable')
      }

      const data = await response.json()

      const textContent = data.content
        .filter((block: { type: string }) => block.type === 'text')
        .map((block: { text?: string }) => block.text || '')
        .join('')

      const inputCost = (data.usage.input_tokens / 1_000_000) * 0.25
      const outputCost = (data.usage.output_tokens / 1_000_000) * 1.25
      const usage = {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        model: this.model,
        cost: inputCost + outputCost,
      }

      const recipe = this.parseJSON<Partial<Recipe>>(textContent)

      if (!recipe) {
        return {
          success: false,
          message: `I couldn't read the recipe from that image. Is it a clear photo of a recipe?`,
        }
      }

      return {
        success: true,
        message: `I've extracted "${recipe.name}" from the image.`,
        data: { recipe, _usage: usage },
        actions: [
          {
            type: 'save_recipe',
            payload: { recipe },
          },
        ],
      }
    } catch (error) {
      console.error('[RecipeAgent] Image processing error:', error)
      return {
        success: false,
        message: `I couldn't process that image. ${error instanceof Error ? error.message : 'Please try again.'}`,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Handle general recipe questions
   */
  private async handleRecipeQuestion(
    question: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const { content, usage } = await this.callAI(
      `You are a helpful recipe assistant. Answer questions about cooking, recipes, and food preparation.

If the user is trying to add a recipe, ask them to:
1. Paste a recipe URL
2. Type or paste the recipe text
3. Upload an image of the recipe`,
      question,
      context
    )

    return {
      success: true,
      message: content,
      data: { _usage: usage },
    }
  }

  // ============ Tool Implementations ============

  private async scrapeUrl(
    params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<ToolResult> {
    const url = params.url as string

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; MealPlannerBot/1.0; +https://mealplanner.dev)',
          Accept: 'text/html,application/xhtml+xml',
        },
      })

      clearTimeout(timeout)

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
        }
      }

      const html = await response.text()

      return {
        success: true,
        data: html,
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch URL',
      }
    }
  }

  private async extractJsonLd(
    params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<ToolResult> {
    const html = params.html as string

    try {
      // Find JSON-LD scripts
      const jsonLdMatches = html.match(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      )

      if (!jsonLdMatches) {
        return { success: false, error: 'No JSON-LD found' }
      }

      for (const match of jsonLdMatches) {
        const jsonContent = match.replace(
          /<script[^>]*>|<\/script>/gi,
          ''
        )

        try {
          const data = JSON.parse(jsonContent)

          // Handle @graph arrays
          const items = data['@graph'] || [data]

          for (const item of items) {
            if (
              item['@type'] === 'Recipe' ||
              (Array.isArray(item['@type']) &&
                item['@type'].includes('Recipe'))
            ) {
              return {
                success: true,
                data: this.mapJsonLdToRecipe(item),
              }
            }
          }
        } catch {
          continue
        }
      }

      return { success: false, error: 'No Recipe schema found' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Parse error',
      }
    }
  }

  private mapJsonLdToRecipe(jsonLd: Record<string, unknown>): Partial<Recipe> {
    const parseTime = (duration: string | undefined): number | null => {
      if (!duration) return null
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
      if (!match) return null
      const hours = parseInt(match[1] || '0')
      const minutes = parseInt(match[2] || '0')
      return hours * 60 + minutes
    }

    const ingredients = Array.isArray(jsonLd.recipeIngredient)
      ? (jsonLd.recipeIngredient as string[]).join('\n')
      : ''

    const instructions = Array.isArray(jsonLd.recipeInstructions)
      ? (jsonLd.recipeInstructions as Array<string | { text: string }>)
          .map((step, i) => {
            const text = typeof step === 'string' ? step : step.text
            return `${i + 1}. ${text}`
          })
          .join('\n')
      : ''

    const totalTime =
      parseTime(jsonLd.totalTime as string) ||
      (parseTime(jsonLd.prepTime as string) || 0) +
        (parseTime(jsonLd.cookTime as string) || 0)

    return {
      name: jsonLd.name as string,
      ingredients,
      instructions,
      prep_time_minutes: parseTime(jsonLd.prepTime as string),
      cook_time_minutes: parseTime(jsonLd.cookTime as string),
      servings: parseInt(jsonLd.recipeYield as string) || 4,
      difficulty:
        totalTime <= 30 ? 'easy' : totalTime <= 60 ? 'medium' : 'hard',
      cuisine: (jsonLd.recipeCuisine as string) || null,
      tags: Array.isArray(jsonLd.keywords)
        ? (jsonLd.keywords as string[]).join(', ')
        : (jsonLd.keywords as string) || null,
      image_url: this.extractImageUrl(jsonLd.image),
      calories: this.extractNutrition(jsonLd.nutrition, 'calories'),
      protein_g: this.extractNutrition(jsonLd.nutrition, 'proteinContent'),
      carbs_g: this.extractNutrition(jsonLd.nutrition, 'carbohydrateContent'),
      fat_g: this.extractNutrition(jsonLd.nutrition, 'fatContent'),
    }
  }

  private extractImageUrl(image: unknown): string | null {
    if (!image) return null
    if (typeof image === 'string') return image
    if (Array.isArray(image)) return image[0] as string
    if (typeof image === 'object' && image !== null) {
      return (image as { url?: string }).url || null
    }
    return null
  }

  private extractNutrition(
    nutrition: unknown,
    field: string
  ): number | null {
    if (!nutrition || typeof nutrition !== 'object') return null
    const value = (nutrition as Record<string, string>)[field]
    if (!value) return null
    const num = parseFloat(value)
    return isNaN(num) ? null : num
  }

  private async parseWithAI(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const content = params.content as string
    const sourceType = params.source_type as string

    try {
      const { content: aiResponse } = await this.callAI(
        this.getRecipeParsingPrompt(sourceType),
        content.slice(0, 50000), // Limit content size
        context
      )

      const recipe = this.parseJSON<Partial<Recipe>>(aiResponse)

      if (!recipe) {
        return { success: false, error: 'Failed to parse AI response' }
      }

      return { success: true, data: recipe }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI parsing failed',
      }
    }
  }

  private async validateRecipe(
    params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<ToolResult> {
    const recipe = params.recipe as Partial<Recipe>
    const errors: string[] = []

    if (!recipe.name || recipe.name.trim().length < 2) {
      errors.push('Recipe name is required')
    }

    if (!recipe.ingredients || recipe.ingredients.trim().length < 10) {
      errors.push('Ingredients are required')
    }

    if (!recipe.instructions || recipe.instructions.trim().length < 20) {
      errors.push('Instructions are required')
    }

    if (errors.length > 0) {
      return { success: false, error: errors.join(', ') }
    }

    return { success: true, data: recipe }
  }

  private async estimateNutrition(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const ingredients = params.ingredients as string
    const servings = params.servings as number

    try {
      const { content } = await this.callAI(
        `You are a nutrition calculator. Estimate the nutritional values per serving based on the ingredients.

Respond with JSON only:
{
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number
}

Be reasonable in estimates. If unsure, provide conservative middle-ground values.`,
        `Ingredients (${servings} servings):\n${ingredients}`,
        context
      )

      const nutrition = this.parseJSON<{
        calories: number
        protein_g: number
        carbs_g: number
        fat_g: number
        fiber_g: number
      }>(content)

      if (!nutrition) {
        return { success: false, error: 'Failed to parse nutrition estimate' }
      }

      return { success: true, data: nutrition }
    } catch {
      return { success: false, error: 'Nutrition estimation failed' }
    }
  }

  // ============ Helper Methods ============

  private looksLikeRecipe(text: string): boolean {
    const recipeIndicators = [
      /ingredients?:/i,
      /instructions?:/i,
      /directions?:/i,
      /steps?:/i,
      /cups?\s+of/i,
      /tablespoons?\s/i,
      /teaspoons?\s/i,
      /preheat\s+(the\s+)?oven/i,
      /cook\s+for\s+\d+/i,
      /bake\s+(for\s+)?\d+/i,
      /\d+\s*(oz|ounces?|lb|pounds?|g|grams?|cups?|tbsp|tsp)/i,
    ]

    return recipeIndicators.some((pattern) => pattern.test(text))
  }

  private getRecipeParsingPrompt(sourceType: string): string {
    return `You are a recipe parser. Extract recipe information from the provided ${sourceType} content.

Return a JSON object with these fields:
{
  "name": "Recipe name",
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
  "ingredients": "One ingredient per line with quantities",
  "instructions": "Numbered steps",
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "servings": number (default 4),
  "difficulty": "easy" | "medium" | "hard",
  "cuisine": "Italian" | "Mexican" | etc or null,
  "tags": "comma-separated tags",
  "notes": "Any special notes" or null,
  "kid_friendly_level": 1-10 (10 = very kid friendly),
  "makes_leftovers": boolean,
  "leftover_days": number or null
}

Difficulty guide:
- easy: <30 min total, simple techniques
- medium: 30-60 min, moderate techniques
- hard: >60 min or complex techniques

Kid friendly guide:
- 10: Mac & cheese, chicken nuggets, pizza
- 7-9: Pasta, tacos, simple proteins
- 4-6: Mixed dishes, some vegetables
- 1-3: Spicy, exotic, or complex flavors

Only respond with the JSON object, no other text.`
  }
}
