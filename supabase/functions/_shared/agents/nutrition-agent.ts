/**
 * Nutrition Agent
 *
 * Specialized agent for nutritional analysis, dietary compliance,
 * allergen detection, and ingredient substitutions.
 */

import { BaseAgent } from './base-agent.ts'
import {
  AgentContext,
  AgentResponse,
  ToolResult,
  Recipe,
  NutritionGoals,
} from './types.ts'

interface NutritionAnalysis {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sodium_mg?: number
  sugar_g?: number
}

interface DietaryCompliance {
  compliant: boolean
  diet: string
  issues: string[]
  suggestions: string[]
}

interface AllergenResult {
  allergen: string
  found: boolean
  ingredients: string[]
  severity: 'high' | 'medium' | 'low'
}

export class NutritionAgent extends BaseAgent {
  constructor() {
    super(
      'nutrition',
      'Analyzes nutrition, checks dietary compliance, detects allergens, and suggests substitutions',
      'claude-haiku-4-5-20251001'
    )
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'calculate_macros',
      description: 'Calculate nutritional macros from ingredients',
      parameters: [
        {
          name: 'ingredients',
          type: 'string',
          description: 'List of ingredients with quantities',
          required: true,
        },
        {
          name: 'servings',
          type: 'number',
          description: 'Number of servings',
          required: true,
        },
      ],
      execute: this.calculateMacros.bind(this),
    })

    this.registerTool({
      name: 'check_allergens',
      description: 'Scan ingredients for common allergens',
      parameters: [
        {
          name: 'ingredients',
          type: 'string',
          description: 'List of ingredients',
          required: true,
        },
        {
          name: 'allergens_to_check',
          type: 'array',
          description: 'Specific allergens to check for',
          required: false,
        },
      ],
      execute: this.checkAllergens.bind(this),
    })

    this.registerTool({
      name: 'check_diet_compliance',
      description: 'Check if recipe complies with a specific diet',
      parameters: [
        {
          name: 'ingredients',
          type: 'string',
          description: 'List of ingredients',
          required: true,
        },
        {
          name: 'diet',
          type: 'string',
          description: 'Diet to check (keto, vegetarian, vegan, paleo, etc.)',
          required: true,
        },
      ],
      execute: this.checkDietCompliance.bind(this),
    })

    this.registerTool({
      name: 'suggest_substitutes',
      description: 'Suggest healthier or allergen-free ingredient substitutes',
      parameters: [
        {
          name: 'ingredient',
          type: 'string',
          description: 'Ingredient to substitute',
          required: true,
        },
        {
          name: 'reason',
          type: 'string',
          description: 'Reason for substitution (allergen, healthier, diet)',
          required: true,
        },
        {
          name: 'diet',
          type: 'string',
          description: 'Diet constraint if applicable',
          required: false,
        },
      ],
      execute: this.suggestSubstitutes.bind(this),
    })

    this.registerTool({
      name: 'analyze_weekly_nutrition',
      description: 'Analyze nutrition across a weekly meal plan',
      parameters: [
        {
          name: 'meals',
          type: 'array',
          description: 'Array of meals with nutrition data',
          required: true,
        },
        {
          name: 'goals',
          type: 'object',
          description: 'Nutrition goals to compare against',
          required: false,
        },
      ],
      execute: this.analyzeWeeklyNutrition.bind(this),
    })
  }

  /**
   * Main processing logic
   */
  async process(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const lowerMessage = message.toLowerCase()

    // Nutrition analysis request
    if (
      lowerMessage.includes('nutrition') ||
      lowerMessage.includes('calories') ||
      lowerMessage.includes('macros') ||
      lowerMessage.includes('protein')
    ) {
      return this.handleNutritionAnalysis(message, context)
    }

    // Allergen check
    if (
      lowerMessage.includes('allerg') ||
      lowerMessage.includes('intoleran')
    ) {
      return this.handleAllergenCheck(message, context)
    }

    // Diet compliance
    if (
      lowerMessage.includes('keto') ||
      lowerMessage.includes('vegan') ||
      lowerMessage.includes('vegetarian') ||
      lowerMessage.includes('paleo') ||
      lowerMessage.includes('diet')
    ) {
      return this.handleDietCompliance(message, context)
    }

    // Substitution request
    if (
      lowerMessage.includes('substitut') ||
      lowerMessage.includes('replace') ||
      lowerMessage.includes('instead of') ||
      lowerMessage.includes('alternative')
    ) {
      return this.handleSubstitutionRequest(message, context)
    }

    // General nutrition question
    return this.handleGeneralQuestion(message, context)
  }

  /**
   * Handle nutrition analysis requests
   */
  private async handleNutritionAnalysis(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[NutritionAgent] Processing nutrition analysis')

    // Check if analyzing a specific recipe from context
    const recentRecipes = context.memory.recentRecipes || []

    // Try to extract recipe reference from message
    const recipeMatch = this.findRecipeInMessage(message, recentRecipes)

    if (recipeMatch) {
      // Analyze specific recipe
      const result = await this.executeTool(
        'calculate_macros',
        {
          ingredients: recipeMatch.ingredients,
          servings: recipeMatch.servings || 4,
        },
        context
      )

      if (!result.success) {
        return {
          success: false,
          message: `I couldn't analyze the nutrition for that recipe. ${result.error}`,
        }
      }

      const nutrition = result.data as NutritionAnalysis
      const goals = context.memory.userPreferences?.nutritionGoals

      let response = `**Nutrition for ${recipeMatch.name}** (per serving)\n\n`
      response += `🔥 Calories: ${nutrition.calories} kcal\n`
      response += `🥩 Protein: ${nutrition.protein_g}g\n`
      response += `🍞 Carbs: ${nutrition.carbs_g}g\n`
      response += `🧈 Fat: ${nutrition.fat_g}g\n`
      response += `🌾 Fiber: ${nutrition.fiber_g}g\n`

      // Compare to goals if available
      if (goals) {
        response += `\n**vs. Your Daily Goals:**\n`
        if (goals.dailyCalories) {
          const pct = Math.round((nutrition.calories / goals.dailyCalories) * 100)
          response += `• Calories: ${pct}% of daily goal\n`
        }
        if (goals.proteinGrams) {
          const pct = Math.round((nutrition.protein_g / goals.proteinGrams) * 100)
          response += `• Protein: ${pct}% of daily goal\n`
        }
      }

      return {
        success: true,
        message: response,
        data: { nutrition, recipe: recipeMatch.name },
      }
    }

    // No specific recipe - provide general guidance
    const { content, usage } = await this.callAI(
      `You are a nutrition expert. Help the user with their nutrition question.

If they're asking about a specific food or meal, provide estimated nutrition info.
If they're asking general questions, provide helpful guidance.

Be specific with numbers when possible. Use these formats:
- Calories: X kcal
- Protein: Xg
- Carbs: Xg
- Fat: Xg`,
      message,
      context
    )

    return {
      success: true,
      message: content,
      data: { _usage: usage },
    }
  }

  /**
   * Handle allergen check requests
   */
  private async handleAllergenCheck(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[NutritionAgent] Processing allergen check')

    const recentRecipes = context.memory.recentRecipes || []
    const recipeMatch = this.findRecipeInMessage(message, recentRecipes)

    // Common allergens to check
    const commonAllergens = [
      'gluten',
      'dairy',
      'eggs',
      'nuts',
      'peanuts',
      'soy',
      'shellfish',
      'fish',
      'sesame',
    ]

    // Extract user's specific allergens if mentioned
    const userAllergens = context.memory.userPreferences?.dietaryRestrictions?.filter(
      (r) => commonAllergens.some((a) => r.toLowerCase().includes(a))
    ) || []

    const allergensToCheck = userAllergens.length > 0 ? userAllergens : commonAllergens

    if (recipeMatch) {
      const result = await this.executeTool(
        'check_allergens',
        {
          ingredients: recipeMatch.ingredients,
          allergens_to_check: allergensToCheck,
        },
        context
      )

      if (!result.success) {
        return {
          success: false,
          message: `I couldn't check allergens for that recipe. ${result.error}`,
        }
      }

      const allergenResults = result.data as AllergenResult[]
      const found = allergenResults.filter((a) => a.found)

      let response = `**Allergen Check for ${recipeMatch.name}**\n\n`

      if (found.length === 0) {
        response += `✅ No common allergens detected!\n`
      } else {
        response += `⚠️ **Allergens Found:**\n`
        for (const allergen of found) {
          const icon = allergen.severity === 'high' ? '🔴' : allergen.severity === 'medium' ? '🟡' : '🟢'
          response += `${icon} **${allergen.allergen}**: Found in ${allergen.ingredients.join(', ')}\n`
        }
      }

      // Suggest substitutions for found allergens
      if (found.length > 0) {
        response += `\nWould you like substitution suggestions for any of these ingredients?`
      }

      return {
        success: true,
        message: response,
        data: { allergens: allergenResults, recipe: recipeMatch.name },
      }
    }

    // General allergen question
    const { content, usage } = await this.callAI(
      `You are an allergen expert. Help the user understand allergens in food.

Common food allergens:
- Gluten (wheat, barley, rye)
- Dairy (milk, cheese, butter)
- Eggs
- Tree nuts (almonds, walnuts, cashews)
- Peanuts
- Soy
- Shellfish (shrimp, crab, lobster)
- Fish
- Sesame

Provide helpful, accurate information about allergens and cross-contamination risks.`,
      message,
      context
    )

    return {
      success: true,
      message: content,
      data: { _usage: usage },
    }
  }

  /**
   * Handle diet compliance requests
   */
  private async handleDietCompliance(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[NutritionAgent] Processing diet compliance check')

    // Extract diet from message
    const diet = this.extractDietFromMessage(message)

    const recentRecipes = context.memory.recentRecipes || []
    const recipeMatch = this.findRecipeInMessage(message, recentRecipes)

    if (recipeMatch && diet) {
      const result = await this.executeTool(
        'check_diet_compliance',
        {
          ingredients: recipeMatch.ingredients,
          diet,
        },
        context
      )

      if (!result.success) {
        return {
          success: false,
          message: `I couldn't check diet compliance. ${result.error}`,
        }
      }

      const compliance = result.data as DietaryCompliance

      let response = `**${diet.charAt(0).toUpperCase() + diet.slice(1)} Check for ${recipeMatch.name}**\n\n`

      if (compliance.compliant) {
        response += `✅ This recipe is ${diet}-compliant!\n`
      } else {
        response += `❌ This recipe is NOT ${diet}-compliant.\n\n`
        response += `**Issues:**\n${compliance.issues.map((i) => `• ${i}`).join('\n')}\n`

        if (compliance.suggestions.length > 0) {
          response += `\n**Suggestions to make it compliant:**\n${compliance.suggestions.map((s) => `• ${s}`).join('\n')}`
        }
      }

      return {
        success: true,
        message: response,
        data: { compliance, recipe: recipeMatch.name },
      }
    }

    // General diet question
    const { content, usage } = await this.callAI(
      `You are a diet and nutrition expert. Help the user understand different diets and their requirements.

Common diets:
- Keto: Very low carb (<20-50g/day), high fat, moderate protein
- Vegetarian: No meat or fish, may include eggs and dairy
- Vegan: No animal products at all
- Paleo: Whole foods, no grains, legumes, or processed foods
- Mediterranean: Plant-based, healthy fats, moderate fish and poultry
- Whole30: No sugar, alcohol, grains, legumes, soy, or dairy for 30 days
- Low-FODMAP: Avoids certain fermentable carbs for digestive issues

Provide practical, accurate guidance.`,
      message,
      context
    )

    return {
      success: true,
      message: content,
      data: { _usage: usage },
    }
  }

  /**
   * Handle substitution requests
   */
  private async handleSubstitutionRequest(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[NutritionAgent] Processing substitution request')

    // Extract the ingredient to substitute
    const { content, usage } = await this.callAI(
      `You are a cooking and nutrition expert specializing in ingredient substitutions.

When suggesting substitutes, consider:
1. Flavor profile similarity
2. Texture similarity
3. Cooking behavior
4. Nutritional impact
5. Allergen considerations
6. Diet compatibility

Format your response as:
**Substitutes for [ingredient]:**
1. **Best choice**: [substitute] - [why it works]
2. **Good alternative**: [substitute] - [why it works]
3. **In a pinch**: [substitute] - [limitations]

Also mention any ratio adjustments needed.`,
      message,
      context
    )

    return {
      success: true,
      message: content,
      data: { _usage: usage },
    }
  }

  /**
   * Handle general nutrition questions
   */
  private async handleGeneralQuestion(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const { content, usage } = await this.callAI(
      `You are a friendly nutrition expert. Answer questions about:
- Food nutrition and health
- Dietary requirements and restrictions
- Meal balancing and portion sizes
- Healthy eating habits
- Nutritional content of foods

Be accurate, helpful, and practical. If you're unsure about something, say so.`,
      message,
      context
    )

    return {
      success: true,
      message: content,
      data: { _usage: usage },
    }
  }

  // ============ Tool Implementations ============

  private async calculateMacros(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const ingredients = params.ingredients as string
    const servings = params.servings as number

    try {
      const { content } = await this.callAI(
        `You are a nutrition calculator. Estimate the nutritional values per serving based on the ingredients provided.

Use your knowledge of food nutrition to provide reasonable estimates. Be conservative if unsure.

Respond with JSON only:
{
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "fiber_g": number,
  "sodium_mg": number,
  "sugar_g": number
}`,
        `Calculate nutrition per serving for this recipe (${servings} servings total):\n\n${ingredients}`,
        context
      )

      const nutrition = this.parseJSON<NutritionAnalysis>(content)

      if (!nutrition) {
        return { success: false, error: 'Failed to parse nutrition data' }
      }

      return { success: true, data: nutrition }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
      }
    }
  }

  private async checkAllergens(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const ingredients = params.ingredients as string
    const allergensToCheck = (params.allergens_to_check as string[]) || [
      'gluten',
      'dairy',
      'eggs',
      'nuts',
      'peanuts',
      'soy',
      'shellfish',
      'fish',
      'sesame',
    ]

    try {
      const { content } = await this.callAI(
        `You are an allergen detection expert. Analyze the ingredients for the presence of these allergens: ${allergensToCheck.join(', ')}

Consider:
- Direct presence (e.g., "milk" = dairy)
- Hidden sources (e.g., "soy sauce" = soy and often gluten)
- Cross-contamination risks (e.g., "may contain traces")

Respond with JSON:
{
  "allergens": [
    {
      "allergen": "name",
      "found": true/false,
      "ingredients": ["ingredient1", "ingredient2"],
      "severity": "high" | "medium" | "low"
    }
  ]
}

Severity guide:
- high: Main ingredient contains allergen
- medium: Secondary ingredient or hidden source
- low: Possible cross-contamination`,
        `Ingredients to analyze:\n${ingredients}`,
        context
      )

      const result = this.parseJSON<{ allergens: AllergenResult[] }>(content)

      if (!result) {
        return { success: false, error: 'Failed to parse allergen data' }
      }

      return { success: true, data: result.allergens }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Check failed',
      }
    }
  }

  private async checkDietCompliance(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const ingredients = params.ingredients as string
    const diet = params.diet as string

    const dietRules: Record<string, string> = {
      keto: 'Very low carb (<20-50g net carbs/day), high fat, no sugar, no grains, no starchy vegetables',
      vegetarian: 'No meat, poultry, or fish. Eggs and dairy are allowed.',
      vegan: 'No animal products: no meat, fish, dairy, eggs, honey, or gelatin',
      paleo: 'No grains, legumes, dairy, refined sugar, or processed foods. Focus on meat, fish, vegetables, fruits, nuts.',
      'gluten-free': 'No wheat, barley, rye, or products containing gluten',
      'dairy-free': 'No milk, cheese, butter, cream, yogurt, or products containing dairy',
      whole30: 'No sugar, alcohol, grains, legumes, soy, dairy, or processed additives',
      mediterranean: 'Emphasis on olive oil, fish, vegetables, whole grains. Limited red meat and sweets.',
    }

    const rules = dietRules[diet.toLowerCase()] || `Following ${diet} diet principles`

    try {
      const { content } = await this.callAI(
        `You are a diet compliance expert. Check if these ingredients comply with the ${diet} diet.

Diet rules: ${rules}

Respond with JSON:
{
  "compliant": true/false,
  "diet": "${diet}",
  "issues": ["list of non-compliant ingredients and why"],
  "suggestions": ["how to modify to make compliant"]
}`,
        `Ingredients to check:\n${ingredients}`,
        context
      )

      const result = this.parseJSON<DietaryCompliance>(content)

      if (!result) {
        return { success: false, error: 'Failed to parse compliance data' }
      }

      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Check failed',
      }
    }
  }

  private async suggestSubstitutes(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const ingredient = params.ingredient as string
    const reason = params.reason as string
    const diet = params.diet as string | undefined

    try {
      const { content } = await this.callAI(
        `You are a culinary substitution expert. Suggest substitutes for the given ingredient.

Consider:
- Reason for substitution: ${reason}
${diet ? `- Must be compatible with: ${diet} diet` : ''}
- Flavor and texture similarity
- Cooking behavior
- Availability

Respond with JSON:
{
  "ingredient": "${ingredient}",
  "substitutes": [
    {
      "name": "substitute name",
      "ratio": "1:1 or specific ratio",
      "notes": "any special instructions",
      "best_for": "what dishes/uses",
      "limitations": "when not to use"
    }
  ]
}`,
        `Find substitutes for: ${ingredient}`,
        context
      )

      const result = this.parseJSON<{
        ingredient: string
        substitutes: Array<{
          name: string
          ratio: string
          notes: string
          best_for: string
          limitations: string
        }>
      }>(content)

      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Suggestion failed',
      }
    }
  }

  private async analyzeWeeklyNutrition(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const meals = params.meals as Array<{ name: string; nutrition: NutritionAnalysis }>
    const goals = params.goals as NutritionGoals | undefined

    // Aggregate daily totals
    const dailyTotals = meals.reduce(
      (acc, meal) => {
        acc.calories += meal.nutrition.calories || 0
        acc.protein += meal.nutrition.protein_g || 0
        acc.carbs += meal.nutrition.carbs_g || 0
        acc.fat += meal.nutrition.fat_g || 0
        acc.fiber += meal.nutrition.fiber_g || 0
        return acc
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    )

    // Calculate daily averages (assuming 7 days)
    const days = 7
    const dailyAvg = {
      calories: Math.round(dailyTotals.calories / days),
      protein: Math.round(dailyTotals.protein / days),
      carbs: Math.round(dailyTotals.carbs / days),
      fat: Math.round(dailyTotals.fat / days),
      fiber: Math.round(dailyTotals.fiber / days),
    }

    // Compare to goals if provided
    let goalComparison = null
    if (goals) {
      goalComparison = {
        calories: goals.dailyCalories
          ? Math.round((dailyAvg.calories / goals.dailyCalories) * 100)
          : null,
        protein: goals.proteinGrams
          ? Math.round((dailyAvg.protein / goals.proteinGrams) * 100)
          : null,
        carbs: goals.carbsGrams
          ? Math.round((dailyAvg.carbs / goals.carbsGrams) * 100)
          : null,
        fat: goals.fatGrams
          ? Math.round((dailyAvg.fat / goals.fatGrams) * 100)
          : null,
      }
    }

    return {
      success: true,
      data: {
        weeklyTotals: dailyTotals,
        dailyAverages: dailyAvg,
        goalComparison,
        mealsAnalyzed: meals.length,
      },
    }
  }

  // ============ Helper Methods ============

  private findRecipeInMessage(
    message: string,
    recipes: Recipe[]
  ): Recipe | null {
    const lowerMessage = message.toLowerCase()

    for (const recipe of recipes) {
      if (lowerMessage.includes(recipe.name.toLowerCase())) {
        return recipe
      }
    }

    // Check for "this recipe" or "that recipe" - use most recent
    if (
      lowerMessage.includes('this recipe') ||
      lowerMessage.includes('that recipe') ||
      lowerMessage.includes('the recipe')
    ) {
      return recipes[0] || null
    }

    return null
  }

  private extractDietFromMessage(message: string): string | null {
    const lowerMessage = message.toLowerCase()
    const diets = [
      'keto',
      'vegetarian',
      'vegan',
      'paleo',
      'gluten-free',
      'dairy-free',
      'whole30',
      'mediterranean',
      'low-carb',
      'low-fat',
    ]

    for (const diet of diets) {
      if (lowerMessage.includes(diet)) {
        return diet
      }
    }

    return null
  }
}
