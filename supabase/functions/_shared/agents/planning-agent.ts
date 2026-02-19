/**
 * Planning Agent
 *
 * Specialized agent for meal planning, scheduling, and optimization.
 * Handles weekly plan generation, meal suggestions, and leftover integration.
 */

import { BaseAgent } from './base-agent.ts'
import {
  AgentContext,
  AgentResponse,
  AgentTool,
  ToolResult,
  Recipe,
  ScheduledMeal,
} from './types.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

export class PlanningAgent extends BaseAgent {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    super(
      'planning',
      'Generates intelligent meal plans based on preferences, leftovers, and dietary goals',
      'claude-haiku-4-5-20251001'
    )

    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'query_recipes',
      description: "Search user's recipe database with filters",
      parameters: [
        {
          name: 'meal_type',
          type: 'string',
          description: 'Filter by meal type',
          required: false,
        },
        {
          name: 'cuisine',
          type: 'string',
          description: 'Filter by cuisine',
          required: false,
        },
        {
          name: 'max_time',
          type: 'number',
          description: 'Maximum total time in minutes',
          required: false,
        },
        {
          name: 'kid_friendly',
          type: 'boolean',
          description: 'Only kid-friendly recipes',
          required: false,
        },
        {
          name: 'difficulty',
          type: 'string',
          description: 'Maximum difficulty level',
          required: false,
        },
      ],
      execute: this.queryRecipes.bind(this),
    })

    this.registerTool({
      name: 'check_leftovers',
      description: 'Get active leftovers that should be used',
      parameters: [],
      execute: this.checkLeftovers.bind(this),
    })

    this.registerTool({
      name: 'get_meal_history',
      description: 'Get recently cooked meals to avoid repetition',
      parameters: [
        {
          name: 'days',
          type: 'number',
          description: 'Number of days to look back',
          required: false,
          default: 14,
        },
      ],
      execute: this.getMealHistory.bind(this),
    })

    this.registerTool({
      name: 'score_meal_fit',
      description: 'Score how well a meal fits a specific slot',
      parameters: [
        {
          name: 'recipe',
          type: 'object',
          description: 'The recipe to score',
          required: true,
        },
        {
          name: 'day_of_week',
          type: 'string',
          description: 'Day of the week',
          required: true,
        },
        {
          name: 'meal_type',
          type: 'string',
          description: 'Meal type slot',
          required: true,
        },
      ],
      execute: this.scoreMealFit.bind(this),
    })

    this.registerTool({
      name: 'generate_plan',
      description: 'Generate a complete meal plan',
      parameters: [
        {
          name: 'days',
          type: 'number',
          description: 'Number of days to plan',
          required: false,
          default: 7,
        },
        {
          name: 'include_breakfast',
          type: 'boolean',
          description: 'Include breakfast slots',
          required: false,
          default: false,
        },
        {
          name: 'include_lunch',
          type: 'boolean',
          description: 'Include lunch slots',
          required: false,
          default: false,
        },
      ],
      execute: this.generatePlan.bind(this),
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

    // Detect planning requests
    if (
      lowerMessage.includes('plan') ||
      lowerMessage.includes('week') ||
      lowerMessage.includes('schedule')
    ) {
      return this.handlePlanningRequest(message, context)
    }

    // Detect suggestion requests
    if (
      lowerMessage.includes('suggest') ||
      lowerMessage.includes('what should') ||
      lowerMessage.includes('idea')
    ) {
      return this.handleSuggestionRequest(message, context)
    }

    // Detect leftover queries
    if (lowerMessage.includes('leftover') || lowerMessage.includes('use up')) {
      return this.handleLeftoverRequest(message, context)
    }

    // General planning question
    return this.handleGeneralRequest(message, context)
  }

  /**
   * Handle meal planning requests
   */
  private async handlePlanningRequest(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[PlanningAgent] Processing planning request')

    // Get user's recipes
    const recipesResult = await this.executeTool('query_recipes', {}, context)

    if (
      !recipesResult.success ||
      !(recipesResult.data as Recipe[])?.length
    ) {
      return {
        success: false,
        message: `You don't have any recipes saved yet. Would you like to add some recipes first? You can paste a URL, type a recipe, or upload a photo.`,
        nextAgent: 'recipe',
      }
    }

    const recipes = recipesResult.data as Recipe[]

    // Check for leftovers to prioritize
    const leftoversResult = await this.executeTool('check_leftovers', {}, context)
    const leftovers = (leftoversResult.data as Array<{ meal_name: string; servings_remaining: number; expiry_date: string }>) || []

    // Get meal history to avoid repetition
    const historyResult = await this.executeTool(
      'get_meal_history',
      { days: 14 },
      context
    )
    const recentMeals = (historyResult.data as string[]) || []

    // Use AI to generate an optimized plan
    const { content, usage } = await this.callAI(
      this.getPlanningPrompt(),
      this.buildPlanningContext(
        recipes,
        leftovers,
        recentMeals,
        context,
        message
      ),
      context
    )

    const plan = this.parseJSON<{
      days: Array<{
        date: string
        meals: Array<{
          meal_type: string
          recipe_id?: string
          recipe_name: string
          notes?: string
          servings: number
        }>
      }>
      summary: string
    }>(content)

    if (!plan) {
      return {
        success: false,
        message: `I had trouble generating the plan. Let me try a simpler approach.`,
        data: { _usage: usage },
      }
    }

    return {
      success: true,
      message: plan.summary,
      data: {
        plan: plan.days,
        leftoversUsed: leftovers.length,
        recipesAvailable: recipes.length,
        _usage: usage,
      },
      actions: [
        {
          type: 'update_plan',
          payload: { plan: plan.days },
        },
      ],
    }
  }

  /**
   * Handle meal suggestion requests
   */
  private async handleSuggestionRequest(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[PlanningAgent] Processing suggestion request')

    // Parse what kind of suggestion they want
    const mealType = this.extractMealType(message)
    const timeConstraint = this.extractTimeConstraint(message)

    // Query appropriate recipes
    const filters: Record<string, unknown> = {}
    if (mealType) filters.meal_type = mealType
    if (timeConstraint) filters.max_time = timeConstraint

    const recipesResult = await this.executeTool('query_recipes', filters, context)
    const recipes = (recipesResult.data as Recipe[]) || []

    if (recipes.length === 0) {
      return {
        success: true,
        message: `I don't have any ${mealType || ''} recipes that match. Would you like to add some new recipes?`,
        nextAgent: 'recipe',
      }
    }

    // Check leftovers first
    const leftoversResult = await this.executeTool('check_leftovers', {}, context)
    const leftovers = (leftoversResult.data as Array<{ meal_name: string; servings_remaining: number; expiry_date: string }>) || []

    // Use AI to pick best suggestions
    const { content, usage } = await this.callAI(
      `You are a meal suggestion assistant. Based on the available recipes and context, suggest 3 great options.

Consider:
- User's preferences and dietary needs
- Time constraints mentioned
- Active leftovers that should be used
- Variety from recent meals

Respond with JSON:
{
  "suggestions": [
    {
      "recipe_id": "id",
      "recipe_name": "name",
      "reason": "Why this is a good choice",
      "time_estimate": "30 min"
    }
  ],
  "leftover_alert": "Message about leftovers to use" or null
}`,
      `User request: ${message}

Available recipes:
${recipes.slice(0, 20).map((r) => `- ${r.name} (${r.id}): ${r.cuisine || 'unknown'}, ${r.difficulty}, ${(r.prep_time_minutes || 0) + (r.cook_time_minutes || 0)} min`).join('\n')}

Active leftovers:
${leftovers.map((l) => `- ${l.meal_name}: ${l.servings_remaining} servings, expires ${l.expiry_date}`).join('\n') || 'None'}`,
      context
    )

    const result = this.parseJSON<{
      suggestions: Array<{
        recipe_id: string
        recipe_name: string
        reason: string
        time_estimate: string
      }>
      leftover_alert: string | null
    }>(content)

    if (!result) {
      // Fallback to simple random selection
      const randomRecipes = recipes
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)

      return {
        success: true,
        message: `Here are some options:\n${randomRecipes.map((r) => `• ${r.name}`).join('\n')}`,
        data: { suggestions: randomRecipes, _usage: usage },
      }
    }

    let responseMessage = `Here are my suggestions:\n\n${result.suggestions.map((s, i) => `${i + 1}. **${s.recipe_name}** (${s.time_estimate})\n   ${s.reason}`).join('\n\n')}`

    if (result.leftover_alert) {
      responseMessage += `\n\n⚠️ ${result.leftover_alert}`
    }

    return {
      success: true,
      message: responseMessage,
      data: {
        suggestions: result.suggestions,
        leftovers,
        _usage: usage,
      },
    }
  }

  /**
   * Handle leftover-related requests
   */
  private async handleLeftoverRequest(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const leftoversResult = await this.executeTool('check_leftovers', {}, context)
    const leftovers = (leftoversResult.data as Array<{
      id: string
      meal_name: string
      servings_remaining: number
      expiry_date: string
      created_date: string
    }>) || []

    if (leftovers.length === 0) {
      return {
        success: true,
        message: `You don't have any leftovers tracked right now. After cooking a meal that makes extras, you can add it to your leftover inventory.`,
      }
    }

    // Sort by expiry date (soonest first)
    const sorted = leftovers.sort(
      (a, b) =>
        new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
    )

    const urgent = sorted.filter(
      (l) =>
        new Date(l.expiry_date).getTime() - Date.now() < 2 * 24 * 60 * 60 * 1000
    )

    let responseMessage = `**Your Leftovers:**\n\n`

    if (urgent.length > 0) {
      responseMessage += `⚠️ **Use soon:**\n${urgent.map((l) => `• ${l.meal_name} (${l.servings_remaining} servings) - expires ${l.expiry_date}`).join('\n')}\n\n`
    }

    const notUrgent = sorted.filter(
      (l) =>
        new Date(l.expiry_date).getTime() - Date.now() >= 2 * 24 * 60 * 60 * 1000
    )

    if (notUrgent.length > 0) {
      responseMessage += `**Still good:**\n${notUrgent.map((l) => `• ${l.meal_name} (${l.servings_remaining} servings) - expires ${l.expiry_date}`).join('\n')}`
    }

    return {
      success: true,
      message: responseMessage,
      data: { leftovers: sorted, urgent: urgent.length },
    }
  }

  /**
   * Handle general planning questions
   */
  private async handleGeneralRequest(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const { content, usage } = await this.callAI(
      `You are a helpful meal planning assistant. Answer questions about meal planning, scheduling, and organization.

Available commands:
- "Plan my week" - Generate a weekly meal plan
- "What should I make for dinner?" - Get meal suggestions
- "Check my leftovers" - See what leftovers need to be used
- "Suggest something quick" - Get fast meal ideas

Be helpful and conversational.`,
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

  private async queryRecipes(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    try {
      let query = this.supabase
        .from('meals')
        .select('*')
        .eq('user_id', context.userId)

      if (params.meal_type) {
        query = query.eq('meal_type', params.meal_type)
      }

      if (params.cuisine) {
        const escapedCuisine = String(params.cuisine).replace(/%/g, '\\%').replace(/_/g, '\\_')
        query = query.ilike('cuisine', `%${escapedCuisine}%`)
      }

      if (params.max_time) {
        // Filter by total time (prep + cook)
        query = query.or(
          `prep_time_minutes.lte.${params.max_time},cook_time_minutes.lte.${params.max_time}`
        )
      }

      if (params.kid_friendly) {
        query = query.gte('kid_friendly_level', 7)
      }

      if (params.difficulty) {
        const levels = ['easy', 'medium', 'hard']
        const maxIndex = levels.indexOf(params.difficulty as string)
        if (maxIndex >= 0) {
          query = query.in('difficulty', levels.slice(0, maxIndex + 1))
        }
      }

      const { data, error } = await query.limit(50)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      }
    }
  }

  private async checkLeftovers(
    _params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    try {
      const { data, error } = await this.supabase
        .from('leftovers_inventory')
        .select('*, meals(name)')
        .eq('user_id', context.userId)
        .gt('expires_date', new Date().toISOString())
        .gt('servings_remaining', 0)
        .order('expires_date')

      if (error) {
        return { success: false, error: error.message }
      }

      const leftovers = data?.map((l) => ({
        id: l.id,
        meal_id: l.meal_id,
        meal_name: l.meals?.name || 'Unknown',
        servings_remaining: l.servings_remaining,
        created_date: l.created_date,
        expiry_date: l.expires_date,
      }))

      return { success: true, data: leftovers }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      }
    }
  }

  private async getMealHistory(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const days = (params.days as number) || 14
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    try {
      const { data, error } = await this.supabase
        .from('meal_history')
        .select('meals(name)')
        .eq('user_id', context.userId)
        .gte('cooked_date', cutoffDate.toISOString())

      if (error) {
        return { success: false, error: error.message }
      }

      const mealNames = data?.map((h) => h.meals?.name).filter(Boolean)

      return { success: true, data: mealNames }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      }
    }
  }

  private async scoreMealFit(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const recipe = params.recipe as Recipe
    const dayOfWeek = params.day_of_week as string
    const mealType = params.meal_type as string

    let score = 50 // Base score

    // Meal type match
    if (recipe.meal_type === mealType) {
      score += 20
    }

    // Time constraints by day
    const totalTime =
      (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)

    // Weekday dinners should be quicker
    if (['Monday', 'Tuesday', 'Wednesday', 'Thursday'].includes(dayOfWeek)) {
      if (totalTime <= 30) score += 15
      else if (totalTime <= 45) score += 10
      else if (totalTime > 60) score -= 10
    }

    // Weekend can be more elaborate
    if (['Saturday', 'Sunday'].includes(dayOfWeek)) {
      if (recipe.difficulty === 'hard') score += 5
    }

    // Kid-friendly boost if required
    if (
      context.memory.userPreferences?.kidFriendlyRequired &&
      recipe.kid_friendly_level
    ) {
      if (recipe.kid_friendly_level >= 7) score += 15
      else if (recipe.kid_friendly_level <= 3) score -= 20
    }

    // Favorite boost
    if (recipe.is_favorite) {
      score += 10
    }

    return {
      success: true,
      data: { score: Math.max(0, Math.min(100, score)) },
    }
  }

  private async generatePlan(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    // This is handled by the AI call in handlePlanningRequest
    // This tool exists for completeness but delegates to AI
    return {
      success: true,
      data: { message: 'Use handlePlanningRequest for plan generation' },
    }
  }

  // ============ Helper Methods ============

  private getPlanningPrompt(): string {
    return `You are an expert meal planner. Generate a weekly meal plan that:

1. Uses the available recipes wisely
2. Prioritizes leftovers that need to be used
3. Avoids repeating recently cooked meals
4. Balances cuisines throughout the week
5. Considers time constraints (quick meals on weekdays)
6. Respects dietary preferences

Respond with JSON:
{
  "days": [
    {
      "date": "Monday",
      "meals": [
        {
          "meal_type": "dinner",
          "recipe_id": "uuid or null for new",
          "recipe_name": "Recipe Name",
          "notes": "Optional notes",
          "servings": 4
        }
      ]
    }
  ],
  "summary": "Brief friendly summary of the plan"
}`
  }

  private buildPlanningContext(
    recipes: Recipe[],
    leftovers: Array<{ meal_name: string; servings_remaining: number; expiry_date: string }>,
    recentMeals: string[],
    context: AgentContext,
    userRequest: string
  ): string {
    const prefs = context.memory.userPreferences

    return `User request: ${userRequest}

User preferences:
- Household size: ${prefs?.householdSize || 4}
- Kid-friendly required: ${prefs?.kidFriendlyRequired || false}
- Favorite cuisines: ${prefs?.favoriteCuisines?.join(', ') || 'Not specified'}
- Dietary restrictions: ${prefs?.dietaryRestrictions?.join(', ') || 'None'}

Available recipes (${recipes.length} total):
${recipes
  .slice(0, 30)
  .map(
    (r) =>
      `- ${r.name} (${r.id}): ${r.meal_type}, ${r.cuisine || 'unknown'}, ${r.difficulty}, ${(r.prep_time_minutes || 0) + (r.cook_time_minutes || 0)} min${r.is_favorite ? ' ⭐' : ''}`
  )
  .join('\n')}

Active leftovers to use:
${leftovers.length > 0 ? leftovers.map((l) => `- ${l.meal_name}: ${l.servings_remaining} servings, expires ${l.expiry_date}`).join('\n') : 'None'}

Recently cooked (avoid repeating):
${recentMeals.length > 0 ? recentMeals.join(', ') : 'None tracked'}`
  }

  private extractMealType(
    message: string
  ): 'breakfast' | 'lunch' | 'dinner' | 'snack' | null {
    const lower = message.toLowerCase()
    if (lower.includes('breakfast')) return 'breakfast'
    if (lower.includes('lunch')) return 'lunch'
    if (lower.includes('dinner') || lower.includes('tonight')) return 'dinner'
    if (lower.includes('snack')) return 'snack'
    return null
  }

  private extractTimeConstraint(message: string): number | null {
    const lower = message.toLowerCase()
    if (lower.includes('quick') || lower.includes('fast')) return 30
    if (lower.includes('15 min')) return 15
    if (lower.includes('30 min') || lower.includes('half hour')) return 30
    if (lower.includes('hour') || lower.includes('60 min')) return 60
    return null
  }
}
