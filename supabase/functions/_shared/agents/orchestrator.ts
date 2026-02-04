/**
 * Orchestrator Agent
 *
 * The central coordinator that routes requests to specialized agents,
 * manages workflows, and handles multi-agent coordination.
 */

import { BaseAgent } from './base-agent.ts'
import {
  AgentType,
  AgentContext,
  AgentResponse,
  IntentClassification,
  Intent,
  ExtractedEntity,
  SharedMemory,
  TokenUsage,
} from './types.ts'
import { RecipeAgent } from './recipe-agent.ts'
import { PlanningAgent } from './planning-agent.ts'
import { NutritionAgent } from './nutrition-agent.ts'
import { ShoppingAgent } from './shopping-agent.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

export class OrchestratorAgent extends BaseAgent {
  private agents: Map<AgentType, BaseAgent> = new Map()
  private supabase: ReturnType<typeof createClient>

  constructor() {
    super(
      'orchestrator',
      'Central coordinator that routes requests to specialized agents and manages workflows',
      'claude-3-5-sonnet-20241022' // Use Sonnet for orchestration (better reasoning)
    )

    // Initialize Supabase client
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Initialize specialized agents
    this.agents.set('recipe', new RecipeAgent())
    this.agents.set('planning', new PlanningAgent())
    this.agents.set('nutrition', new NutritionAgent())
    this.agents.set('shopping', new ShoppingAgent())
  }

  protected registerTools(): void {
    // Orchestrator doesn't have tools - it coordinates other agents
  }

  /**
   * Main entry point for processing user messages
   */
  async process(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const startTime = Date.now()
    let totalUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      model: this.model,
      cost: 0,
    }

    try {
      // Step 1: Classify intent
      const { intent, usage: intentUsage } = await this.classifyIntent(
        message,
        context
      )
      totalUsage = this.mergeUsage(totalUsage, intentUsage)

      console.log(
        `[Orchestrator] Classified intent: ${intent.primaryIntent} (confidence: ${intent.confidence})`
      )

      // Step 2: Route to appropriate agent(s)
      const agentResponses = await this.routeToAgents(intent, message, context)

      // Merge usage from all agents
      for (const response of agentResponses) {
        if (response.usage) {
          totalUsage = this.mergeUsage(totalUsage, response.usage)
        }
      }

      // Step 3: Aggregate responses
      const { response, usage: aggregateUsage } = await this.aggregateResponses(
        agentResponses,
        intent,
        context
      )
      totalUsage = this.mergeUsage(totalUsage, aggregateUsage)

      // Step 4: Log conversation
      await this.logConversation(context, message, response)

      const executionTime = Date.now() - startTime
      console.log(
        `[Orchestrator] Completed in ${executionTime}ms, tokens: ${totalUsage.inputTokens}/${totalUsage.outputTokens}, cost: $${totalUsage.cost.toFixed(4)}`
      )

      return {
        ...response,
        data: {
          ...response.data,
          _meta: {
            executionTimeMs: executionTime,
            tokenUsage: totalUsage,
            intent: intent.primaryIntent,
          },
        },
      }
    } catch (error) {
      console.error('[Orchestrator] Error:', error)
      return {
        success: false,
        message:
          "I'm sorry, I encountered an error processing your request. Please try again.",
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Classify user intent using AI
   */
  private async classifyIntent(
    message: string,
    context: AgentContext
  ): Promise<{ intent: IntentClassification; usage: TokenUsage }> {
    const systemPrompt = `You are an intent classifier for a meal planning assistant.

Classify the user's message into one or more intents:
- parse_recipe: User wants to extract/parse a recipe from URL, text, or image
- save_recipe: User wants to save a recipe to their collection
- plan_meals: User wants to create or modify a meal plan
- suggest_meal: User wants meal suggestions for a specific time/occasion
- analyze_nutrition: User wants nutrition analysis or dietary advice
- generate_shopping_list: User wants to create or update shopping list
- check_leftovers: User wants to check or use leftovers
- get_substitution: User wants ingredient substitutions
- general_question: General question about cooking/food
- unknown: Cannot determine intent

Also extract any entities:
- url: Recipe URL
- recipe_name: Name of a specific recipe
- ingredient: Specific ingredient mentioned
- date: Date or day mentioned
- meal_type: breakfast/lunch/dinner/snack
- cuisine: Type of cuisine
- dietary: Dietary restriction or preference

Respond with JSON only:
{
  "primaryIntent": "intent_name",
  "secondaryIntents": ["other_intent"],
  "confidence": 0.95,
  "entities": [
    {"type": "url", "value": "https://...", "confidence": 1.0}
  ]
}`

    const { content, usage } = await this.callAI(systemPrompt, message, context)

    const classification = this.parseJSON<IntentClassification>(content)

    if (!classification) {
      return {
        intent: {
          primaryIntent: 'unknown',
          secondaryIntents: [],
          confidence: 0,
          entities: [],
        },
        usage,
      }
    }

    return { intent: classification, usage }
  }

  /**
   * Route to the appropriate agent(s) based on intent
   */
  private async routeToAgents(
    intent: IntentClassification,
    message: string,
    context: AgentContext
  ): Promise<Array<{ agent: AgentType; response: AgentResponse; usage?: TokenUsage }>> {
    const responses: Array<{
      agent: AgentType
      response: AgentResponse
      usage?: TokenUsage
    }> = []

    // Determine which agents to invoke
    const agentsToInvoke = this.determineAgents(intent)

    for (const agentType of agentsToInvoke) {
      const agent = this.agents.get(agentType)
      if (!agent) continue

      console.log(`[Orchestrator] Invoking ${agentType} agent`)

      try {
        // Pass relevant entities to the agent
        const enrichedMessage = this.enrichMessage(message, intent, agentType)
        const response = await agent.process(enrichedMessage, context)

        responses.push({
          agent: agentType,
          response,
          usage: response.data?._usage as TokenUsage | undefined,
        })

        // If agent requests another agent, chain the call
        if (response.nextAgent) {
          const nextAgent = this.agents.get(response.nextAgent)
          if (nextAgent) {
            console.log(
              `[Orchestrator] Chaining to ${response.nextAgent} agent`
            )
            const chainedResponse = await nextAgent.process(
              JSON.stringify(response.data),
              context
            )
            responses.push({
              agent: response.nextAgent,
              response: chainedResponse,
              usage: chainedResponse.data?._usage as TokenUsage | undefined,
            })
          }
        }
      } catch (error) {
        console.error(`[Orchestrator] Agent ${agentType} error:`, error)
        responses.push({
          agent: agentType,
          response: {
            success: false,
            message: `${agentType} agent encountered an error`,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    }

    return responses
  }

  /**
   * Determine which agents to invoke based on intent
   */
  private determineAgents(intent: IntentClassification): AgentType[] {
    const agents: AgentType[] = []

    const intentToAgent: Record<Intent, AgentType[]> = {
      parse_recipe: ['recipe'],
      save_recipe: ['recipe'],
      plan_meals: ['planning'],
      suggest_meal: ['planning', 'nutrition'],
      analyze_nutrition: ['nutrition'],
      generate_shopping_list: ['shopping'],
      check_leftovers: ['planning'],
      get_substitution: ['nutrition'],
      general_question: [], // Handle in orchestrator
      unknown: [],
    }

    // Add primary intent agents
    const primaryAgents = intentToAgent[intent.primaryIntent] || []
    agents.push(...primaryAgents)

    // Add secondary intent agents (avoid duplicates)
    for (const secondaryIntent of intent.secondaryIntents) {
      const secondaryAgents = intentToAgent[secondaryIntent] || []
      for (const agent of secondaryAgents) {
        if (!agents.includes(agent)) {
          agents.push(agent)
        }
      }
    }

    return agents
  }

  /**
   * Enrich the message with extracted entities for the specific agent
   */
  private enrichMessage(
    message: string,
    intent: IntentClassification,
    agent: AgentType
  ): string {
    const relevantEntities = intent.entities.filter((e) => {
      // Filter entities relevant to each agent
      switch (agent) {
        case 'recipe':
          return ['url', 'recipe_name', 'ingredient'].includes(e.type)
        case 'planning':
          return ['date', 'meal_type', 'recipe_name', 'cuisine'].includes(
            e.type
          )
        case 'nutrition':
          return ['ingredient', 'dietary', 'recipe_name'].includes(e.type)
        case 'shopping':
          return ['ingredient', 'recipe_name'].includes(e.type)
        default:
          return false
      }
    })

    if (relevantEntities.length === 0) {
      return message
    }

    return `${message}\n\n<extracted_entities>\n${JSON.stringify(relevantEntities, null, 2)}\n</extracted_entities>`
  }

  /**
   * Aggregate responses from multiple agents into a cohesive response
   */
  private async aggregateResponses(
    agentResponses: Array<{ agent: AgentType; response: AgentResponse }>,
    intent: IntentClassification,
    context: AgentContext
  ): Promise<{ response: AgentResponse; usage: TokenUsage }> {
    // If only one agent responded, return its response directly
    if (agentResponses.length === 1) {
      return {
        response: agentResponses[0].response,
        usage: { inputTokens: 0, outputTokens: 0, model: this.model, cost: 0 },
      }
    }

    // If no agents responded, handle general question
    if (agentResponses.length === 0) {
      return this.handleGeneralQuestion(intent, context)
    }

    // Multiple agents - aggregate their responses
    const systemPrompt = `You are aggregating responses from multiple specialized agents into a single cohesive response for the user.

The user's primary intent was: ${intent.primaryIntent}

Combine the following agent responses into a natural, helpful response:
${agentResponses.map((r) => `\n[${r.agent.toUpperCase()} AGENT]\n${r.response.message}\nData: ${JSON.stringify(r.response.data)}`).join('\n')}

Provide a unified response that:
1. Addresses the user's primary intent
2. Incorporates relevant information from all agents
3. Is conversational and helpful
4. Highlights any actions that were taken

Respond with JSON:
{
  "message": "Your unified response to the user",
  "data": { combined relevant data },
  "actions": [ list of actions taken ]
}`

    const { content, usage } = await this.callAI(
      systemPrompt,
      'Aggregate the agent responses',
      context
    )

    const aggregated = this.parseJSON<AgentResponse>(content)

    if (!aggregated) {
      // Fallback: concatenate messages
      return {
        response: {
          success: agentResponses.every((r) => r.response.success),
          message: agentResponses.map((r) => r.response.message).join('\n\n'),
          data: agentResponses.reduce(
            (acc, r) => ({
              ...acc,
              [r.agent]: r.response.data,
            }),
            {}
          ),
        },
        usage,
      }
    }

    return {
      response: {
        success: agentResponses.every((r) => r.response.success),
        ...aggregated,
      },
      usage,
    }
  }

  /**
   * Handle general questions without specialized agents
   */
  private async handleGeneralQuestion(
    intent: IntentClassification,
    context: AgentContext
  ): Promise<{ response: AgentResponse; usage: TokenUsage }> {
    const systemPrompt = `You are a helpful meal planning assistant. Answer the user's question about cooking, food, or meal planning.

Be concise but helpful. If the question is outside your domain (not about food/cooking/meal planning), politely redirect.

If you don't know something, say so rather than making things up.`

    const userMessage =
      intent.entities.length > 0
        ? `Question context: ${JSON.stringify(intent.entities)}`
        : 'Please help with this general question.'

    const { content, usage } = await this.callAI(
      systemPrompt,
      userMessage,
      context
    )

    return {
      response: {
        success: true,
        message: content,
      },
      usage,
    }
  }

  /**
   * Log conversation to database
   */
  private async logConversation(
    context: AgentContext,
    userMessage: string,
    response: AgentResponse
  ): Promise<void> {
    try {
      // Get or create conversation
      let conversationId = context.conversationId

      if (!conversationId) {
        const { data: conv } = await this.supabase
          .from('agent_conversations')
          .insert({
            user_id: context.userId,
            context: context.metadata,
          })
          .select('id')
          .single()

        conversationId = conv?.id
      }

      if (!conversationId) return

      // Log user message
      await this.supabase.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
      })

      // Log assistant response
      await this.supabase.from('agent_messages').insert({
        conversation_id: conversationId,
        role: 'orchestrator',
        content: response.message,
        tool_results: response.data,
      })

      // Update conversation timestamp
      await this.supabase
        .from('agent_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
    } catch (error) {
      console.error('[Orchestrator] Failed to log conversation:', error)
    }
  }

  /**
   * Load shared memory for context
   */
  async loadMemory(userId: string): Promise<SharedMemory> {
    const memory: SharedMemory = {
      userPreferences: null,
      recentRecipes: [],
      activePlan: null,
      leftovers: [],
      conversationHistory: [],
    }

    try {
      // Load user preferences
      const { data: prefs } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (prefs) {
        memory.userPreferences = {
          dietaryRestrictions: prefs.dietary_restrictions || [],
          favoriteCuisines: prefs.favorite_cuisines || [],
          dislikedIngredients: prefs.disliked_ingredients || [],
          householdSize: prefs.household_size || 1,
          kidFriendlyRequired: prefs.kid_friendly_required || false,
          budgetLevel: prefs.budget_level || 'medium',
          mealPrepDay: prefs.meal_prep_day,
          nutritionGoals: prefs.nutrition_goals,
        }
      }

      // Load recent recipes
      const { data: recipes } = await this.supabase
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (recipes) {
        memory.recentRecipes = recipes
      }

      // Load active leftovers
      const { data: leftovers } = await this.supabase
        .from('leftovers_inventory')
        .select('*, meals(name)')
        .eq('user_id', userId)
        .gt('expiry_date', new Date().toISOString())
        .gt('servings_remaining', 0)

      if (leftovers) {
        memory.leftovers = leftovers.map((l) => ({
          id: l.id,
          meal_id: l.meal_id,
          meal_name: l.meals?.name || 'Unknown',
          servings_remaining: l.servings_remaining,
          created_date: l.created_date,
          expiry_date: l.expiry_date,
        }))
      }

      // Load recent conversation history
      const { data: conversations } = await this.supabase
        .from('agent_conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single()

      if (conversations) {
        const { data: messages } = await this.supabase
          .from('agent_messages')
          .select('*')
          .eq('conversation_id', conversations.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (messages) {
          memory.conversationHistory = messages.reverse().map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
          }))
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Failed to load memory:', error)
    }

    return memory
  }

  /**
   * Merge token usage from multiple calls
   */
  private mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
    return {
      inputTokens: a.inputTokens + b.inputTokens,
      outputTokens: a.outputTokens + b.outputTokens,
      model: a.model, // Keep primary model
      cost: a.cost + b.cost,
    }
  }
}
