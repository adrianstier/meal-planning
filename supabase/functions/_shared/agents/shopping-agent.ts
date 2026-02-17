/**
 * Shopping Agent
 *
 * Specialized agent for shopping list generation, ingredient aggregation,
 * and store optimization.
 */

import { BaseAgent } from './base-agent.ts'
import {
  AgentContext,
  AgentResponse,
  ToolResult,
  Recipe,
  ScheduledMeal,
} from './types.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface ParsedIngredient {
  name: string
  quantity: number
  unit: string
  category: string
  notes?: string
}

interface ShoppingItem {
  name: string
  quantity: number
  unit: string
  category: string
  recipes: string[]
  checked: boolean
}

interface CategoryGroup {
  category: string
  items: ShoppingItem[]
}

export class ShoppingAgent extends BaseAgent {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    super(
      'shopping',
      'Generates optimized shopping lists from meal plans with intelligent aggregation',
      'claude-3-5-haiku-20241022'
    )

    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
  }

  protected registerTools(): void {
    this.registerTool({
      name: 'parse_ingredients',
      description: 'Parse ingredient strings into structured data',
      parameters: [
        {
          name: 'ingredients',
          type: 'string',
          description: 'Raw ingredient list (one per line)',
          required: true,
        },
      ],
      execute: this.parseIngredients.bind(this),
    })

    this.registerTool({
      name: 'aggregate_ingredients',
      description: 'Combine ingredients from multiple recipes',
      parameters: [
        {
          name: 'ingredient_lists',
          type: 'array',
          description: 'Array of parsed ingredient lists',
          required: true,
        },
      ],
      execute: this.aggregateIngredients.bind(this),
    })

    this.registerTool({
      name: 'categorize_items',
      description: 'Group shopping items by store category',
      parameters: [
        {
          name: 'items',
          type: 'array',
          description: 'Array of shopping items',
          required: true,
        },
      ],
      execute: this.categorizeItems.bind(this),
    })

    this.registerTool({
      name: 'get_current_list',
      description: "Get user's current shopping list",
      parameters: [],
      execute: this.getCurrentList.bind(this),
    })

    this.registerTool({
      name: 'save_list',
      description: 'Save shopping list to database',
      parameters: [
        {
          name: 'items',
          type: 'array',
          description: 'Shopping items to save',
          required: true,
        },
      ],
      execute: this.saveList.bind(this),
    })

    this.registerTool({
      name: 'estimate_cost',
      description: 'Estimate total shopping cost',
      parameters: [
        {
          name: 'items',
          type: 'array',
          description: 'Shopping items to estimate',
          required: true,
        },
      ],
      execute: this.estimateCost.bind(this),
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

    // Generate list from meal plan
    if (
      lowerMessage.includes('generate') ||
      lowerMessage.includes('create list') ||
      lowerMessage.includes('shopping list from')
    ) {
      return this.handleGenerateList(message, context)
    }

    // View current list
    if (
      lowerMessage.includes('show') ||
      lowerMessage.includes('view') ||
      lowerMessage.includes('what do i need')
    ) {
      return this.handleViewList(context)
    }

    // Add items to list
    if (lowerMessage.includes('add') && lowerMessage.includes('list')) {
      return this.handleAddItems(message, context)
    }

    // Clear list
    if (lowerMessage.includes('clear') || lowerMessage.includes('empty')) {
      return this.handleClearList(context)
    }

    // Cost estimate
    if (lowerMessage.includes('cost') || lowerMessage.includes('budget')) {
      return this.handleCostEstimate(context)
    }

    // General shopping question
    return this.handleGeneralQuestion(message, context)
  }

  /**
   * Generate shopping list from meal plan
   */
  private async handleGenerateList(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    console.log('[ShoppingAgent] Generating shopping list')

    // Get the active meal plan
    const activePlan = context.memory.activePlan

    if (!activePlan || !activePlan.meals?.length) {
      // Try to get recipes from context
      const recipes = context.memory.recentRecipes

      if (!recipes?.length) {
        return {
          success: false,
          message: `You don't have any meals planned yet. Would you like me to help you plan some meals first?`,
          nextAgent: 'planning',
        }
      }

      // Generate from recent recipes
      return this.generateFromRecipes(recipes, context)
    }

    // Generate from meal plan
    const recipes = activePlan.meals
      .filter((m) => m.meal)
      .map((m) => m.meal as Recipe)

    return this.generateFromRecipes(recipes, context)
  }

  /**
   * Generate list from a set of recipes
   */
  private async generateFromRecipes(
    recipes: Recipe[],
    context: AgentContext
  ): Promise<AgentResponse> {
    // Parse all ingredients
    const allParsedIngredients: Array<{
      recipe: string
      ingredients: ParsedIngredient[]
    }> = []

    for (const recipe of recipes) {
      if (!recipe.ingredients) continue

      const result = await this.executeTool(
        'parse_ingredients',
        { ingredients: recipe.ingredients },
        context
      )

      if (result.success && result.data) {
        allParsedIngredients.push({
          recipe: recipe.name,
          ingredients: result.data as ParsedIngredient[],
        })
      }
    }

    if (allParsedIngredients.length === 0) {
      return {
        success: false,
        message: `I couldn't parse the ingredients from your recipes. Could you check if they have ingredients listed?`,
      }
    }

    // Aggregate ingredients
    const aggregateResult = await this.executeTool(
      'aggregate_ingredients',
      { ingredient_lists: allParsedIngredients },
      context
    )

    if (!aggregateResult.success) {
      return {
        success: false,
        message: `I had trouble combining the ingredients. ${aggregateResult.error}`,
      }
    }

    const aggregatedItems = aggregateResult.data as ShoppingItem[]

    // Categorize by store section
    const categoryResult = await this.executeTool(
      'categorize_items',
      { items: aggregatedItems },
      context
    )

    const categorizedList = (categoryResult.data as CategoryGroup[]) || []

    // Save to database
    await this.executeTool(
      'save_list',
      { items: aggregatedItems },
      context
    )

    // Format response
    let response = `**Shopping List Generated!**\n\n`
    response += `📋 ${aggregatedItems.length} items from ${recipes.length} recipes\n\n`

    for (const category of categorizedList) {
      response += `**${category.category}**\n`
      for (const item of category.items) {
        const qty = item.quantity ? `${item.quantity} ${item.unit}`.trim() : ''
        response += `☐ ${item.name}${qty ? ` (${qty})` : ''}\n`
      }
      response += '\n'
    }

    return {
      success: true,
      message: response,
      data: {
        list: categorizedList,
        itemCount: aggregatedItems.length,
        recipeCount: recipes.length,
      },
      actions: [
        {
          type: 'add_to_list',
          payload: { items: aggregatedItems },
        },
      ],
    }
  }

  /**
   * View current shopping list
   */
  private async handleViewList(context: AgentContext): Promise<AgentResponse> {
    const result = await this.executeTool('get_current_list', {}, context)

    if (!result.success) {
      return {
        success: false,
        message: `I couldn't retrieve your shopping list. ${result.error}`,
      }
    }

    const items = result.data as ShoppingItem[]

    if (!items || items.length === 0) {
      return {
        success: true,
        message: `Your shopping list is empty. Would you like me to generate one from your meal plan?`,
      }
    }

    // Categorize for display
    const categoryResult = await this.executeTool(
      'categorize_items',
      { items },
      context
    )

    const categorizedList = (categoryResult.data as CategoryGroup[]) || []

    const unchecked = items.filter((i) => !i.checked).length
    const checked = items.filter((i) => i.checked).length

    let response = `**Your Shopping List**\n\n`
    response += `📋 ${unchecked} items remaining (${checked} purchased)\n\n`

    for (const category of categorizedList) {
      const categoryItems = category.items.filter((i) => !i.checked)
      if (categoryItems.length === 0) continue

      response += `**${category.category}**\n`
      for (const item of categoryItems) {
        const qty = item.quantity ? `${item.quantity} ${item.unit}`.trim() : ''
        response += `☐ ${item.name}${qty ? ` (${qty})` : ''}\n`
      }
      response += '\n'
    }

    if (checked > 0) {
      response += `\n✅ ${checked} items already purchased`
    }

    return {
      success: true,
      message: response,
      data: { list: categorizedList, remaining: unchecked, purchased: checked },
    }
  }

  /**
   * Add items to shopping list
   */
  private async handleAddItems(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    // Extract items from message using AI
    const { content, usage } = await this.callAI(
      `Extract shopping items from the user's message.

Respond with JSON:
{
  "items": [
    {"name": "item name", "quantity": number or null, "unit": "unit or empty"}
  ]
}

Be smart about parsing:
- "milk" → {"name": "milk", "quantity": 1, "unit": "gallon"}
- "2 lbs chicken" → {"name": "chicken", "quantity": 2, "unit": "lbs"}
- "eggs" → {"name": "eggs", "quantity": 1, "unit": "dozen"}`,
      message,
      context
    )

    const parsed = this.parseJSON<{
      items: Array<{ name: string; quantity: number | null; unit: string }>
    }>(content)

    if (!parsed || !parsed.items?.length) {
      return {
        success: false,
        message: `I couldn't understand what items to add. Could you try again with a clearer list?`,
        data: { _usage: usage },
      }
    }

    // Get current list
    const currentResult = await this.executeTool('get_current_list', {}, context)
    const currentItems = (currentResult.data as ShoppingItem[]) || []

    // Add new items
    const newItems: ShoppingItem[] = parsed.items.map((item) => ({
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || '',
      category: 'Other', // Will be categorized
      recipes: ['Manual'],
      checked: false,
    }))

    const combinedItems = [...currentItems, ...newItems]

    // Save
    await this.executeTool('save_list', { items: combinedItems }, context)

    return {
      success: true,
      message: `Added ${newItems.length} item${newItems.length > 1 ? 's' : ''} to your shopping list:\n${newItems.map((i) => `• ${i.name}`).join('\n')}`,
      data: { addedItems: newItems, _usage: usage },
    }
  }

  /**
   * Clear shopping list
   */
  private async handleClearList(context: AgentContext): Promise<AgentResponse> {
    try {
      await this.supabase
        .from('shopping_items')
        .delete()
        .eq('user_id', context.userId)

      return {
        success: true,
        message: `Your shopping list has been cleared. Would you like to generate a new one from your meal plan?`,
      }
    } catch (error) {
      return {
        success: false,
        message: `I couldn't clear your shopping list. Please try again.`,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Estimate shopping cost
   */
  private async handleCostEstimate(
    context: AgentContext
  ): Promise<AgentResponse> {
    const listResult = await this.executeTool('get_current_list', {}, context)
    const items = (listResult.data as ShoppingItem[]) || []

    if (items.length === 0) {
      return {
        success: true,
        message: `Your shopping list is empty, so there's nothing to estimate!`,
      }
    }

    const costResult = await this.executeTool(
      'estimate_cost',
      { items },
      context
    )

    if (!costResult.success || !costResult.data) {
      return {
        success: false,
        message: `I couldn't estimate the cost for your shopping list. ${costResult.error || 'Please try again.'}`,
      }
    }

    const estimate = costResult.data as {
      total: number
      breakdown: Array<{ category: string; cost: number }>
      confidence: string
    }

    let response = `**Estimated Shopping Cost**\n\n`
    response += `💰 **Total: $${estimate.total.toFixed(2)}**\n\n`

    response += `**By Category:**\n`
    for (const cat of estimate.breakdown) {
      response += `• ${cat.category}: $${cat.cost.toFixed(2)}\n`
    }

    response += `\n_${estimate.confidence}_`

    return {
      success: true,
      message: response,
      data: { estimate },
    }
  }

  /**
   * Handle general shopping questions
   */
  private async handleGeneralQuestion(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const { content, usage } = await this.callAI(
      `You are a helpful shopping assistant for meal planning.

You can help with:
- Generating shopping lists from meal plans
- Adding items to the list
- Organizing items by store section
- Estimating costs
- Tips for efficient grocery shopping

Commands:
- "Generate my shopping list" - Create list from meal plan
- "Show my list" - View current list
- "Add [items] to my list" - Add specific items
- "Clear my list" - Start fresh
- "Estimate cost" - Get price estimate`,
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

  private async parseIngredients(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const ingredients = params.ingredients as string

    try {
      const { content } = await this.callAI(
        `Parse these ingredients into structured data.

For each ingredient, extract:
- name: The ingredient name (normalized, e.g., "onion" not "1 large onion, diced")
- quantity: Numeric quantity
- unit: Unit of measurement (cups, lbs, oz, etc.)
- category: Store category (Produce, Dairy, Meat, Pantry, Frozen, Bakery, Other)
- notes: Preparation notes (diced, chopped, etc.)

Respond with JSON:
{
  "ingredients": [
    {"name": "onion", "quantity": 1, "unit": "", "category": "Produce", "notes": "diced"}
  ]
}`,
        ingredients,
        context
      )

      const result = this.parseJSON<{ ingredients: ParsedIngredient[] }>(content)

      if (!result) {
        return { success: false, error: 'Failed to parse ingredients' }
      }

      return { success: true, data: result.ingredients }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Parse failed',
      }
    }
  }

  private async aggregateIngredients(
    params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<ToolResult> {
    const ingredientLists = params.ingredient_lists as Array<{
      recipe: string
      ingredients: ParsedIngredient[]
    }>

    const aggregated: Map<string, ShoppingItem> = new Map()

    for (const list of ingredientLists) {
      for (const ing of list.ingredients) {
        const key = `${ing.name.toLowerCase()}-${ing.unit.toLowerCase()}`

        if (aggregated.has(key)) {
          const existing = aggregated.get(key)!
          existing.quantity += ing.quantity
          if (!existing.recipes.includes(list.recipe)) {
            existing.recipes.push(list.recipe)
          }
        } else {
          aggregated.set(key, {
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: ing.category,
            recipes: [list.recipe],
            checked: false,
          })
        }
      }
    }

    return { success: true, data: Array.from(aggregated.values()) }
  }

  private async categorizeItems(
    params: Record<string, unknown>,
    _context: AgentContext
  ): Promise<ToolResult> {
    const items = params.items as ShoppingItem[]

    const categories: Map<string, ShoppingItem[]> = new Map()

    // Define category order for typical grocery store layout
    const categoryOrder = [
      'Produce',
      'Bakery',
      'Dairy',
      'Meat',
      'Seafood',
      'Deli',
      'Frozen',
      'Pantry',
      'Canned Goods',
      'Condiments',
      'Spices',
      'Beverages',
      'Snacks',
      'Other',
    ]

    for (const item of items) {
      const category = item.category || 'Other'
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(item)
    }

    // Sort by category order
    const sortedCategories: CategoryGroup[] = categoryOrder
      .filter((cat) => categories.has(cat))
      .map((cat) => ({
        category: cat,
        items: categories.get(cat)!,
      }))

    // Add any categories not in the predefined order
    for (const [cat, items] of categories) {
      if (!categoryOrder.includes(cat)) {
        sortedCategories.push({ category: cat, items })
      }
    }

    return { success: true, data: sortedCategories }
  }

  private async getCurrentList(
    _params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    try {
      const { data, error } = await this.supabase
        .from('shopping_items')
        .select('*')
        .eq('user_id', context.userId)
        .order('category')

      if (error) {
        return { success: false, error: error.message }
      }

      const items: ShoppingItem[] = (data || []).map((row) => ({
        name: row.item_name,
        quantity: typeof row.quantity === 'number' ? row.quantity : parseFloat(row.quantity) || 1,
        unit: '',
        category: row.category || 'Other',
        recipes: [],
        checked: row.is_purchased || false,
      }))

      return { success: true, data: items }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed',
      }
    }
  }

  private async saveList(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const items = params.items as ShoppingItem[]

    try {
      // Clear existing list
      await this.supabase
        .from('shopping_items')
        .delete()
        .eq('user_id', context.userId)

      // Insert new items
      const rows = items.map((item) => ({
        user_id: context.userId,
        item_name: item.name,
        quantity: String(item.quantity),
        category: item.category,
        is_purchased: item.checked,
      }))

      const { error } = await this.supabase.from('shopping_items').insert(rows)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, data: { saved: items.length } }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Save failed',
      }
    }
  }

  private async estimateCost(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const items = params.items as ShoppingItem[]

    try {
      const { content } = await this.callAI(
        `Estimate the total cost for this shopping list based on average US grocery prices.

Provide:
1. Total estimated cost
2. Breakdown by category
3. A confidence statement (e.g., "Estimate based on average prices; actual costs may vary by location and store")

Respond with JSON:
{
  "total": number,
  "breakdown": [{"category": "Produce", "cost": 12.50}],
  "confidence": "string describing estimate accuracy"
}

Use reasonable 2024 US grocery prices. Round to 2 decimal places.`,
        `Shopping items:\n${items.map((i) => `- ${i.quantity} ${i.unit} ${i.name} (${i.category})`).join('\n')}`,
        context
      )

      const estimate = this.parseJSON<{
        total: number
        breakdown: Array<{ category: string; cost: number }>
        confidence: string
      }>(content)

      if (!estimate) {
        return { success: false, error: 'Failed to generate estimate' }
      }

      return { success: true, data: estimate }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Estimation failed',
      }
    }
  }
}
