/**
 * Base Agent Class
 *
 * Abstract base class that all specialized agents extend.
 * Provides common functionality for tool execution, AI calls, and message handling.
 */

import {
  AgentType,
  AgentContext,
  AgentResponse,
  AgentTool,
  ToolResult,
  TokenUsage,
} from './types.ts'

// Anthropic API response types
interface AnthropicMessage {
  id: string
  type: string
  role: string
  content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>
  model: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export abstract class BaseAgent {
  protected name: AgentType
  protected description: string
  protected tools: Map<string, AgentTool> = new Map()
  protected model: string
  protected apiKey: string

  constructor(
    name: AgentType,
    description: string,
    model: string = 'claude-3-5-haiku-20241022'
  ) {
    this.name = name
    this.description = description
    this.model = model
    this.apiKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
    this.registerTools()
  }

  /**
   * Each agent must implement tool registration
   */
  protected abstract registerTools(): void

  /**
   * Each agent must implement its main processing logic
   */
  abstract process(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse>

  /**
   * Register a tool for this agent
   */
  protected registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Execute a registered tool
   */
  protected async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
      }
    }

    try {
      return await tool.execute(params, context)
    } catch (error) {
      console.error(`Tool ${toolName} execution error:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Make an AI call using direct fetch to Anthropic API
   */
  protected async callAI(
    systemPrompt: string,
    userMessage: string,
    context: AgentContext
  ): Promise<{ content: string; usage: TokenUsage }> {
    // Build context from memory
    const contextSummary = this.buildContextSummary(context)

    // 30-second timeout to prevent hanging requests
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
          system: `${systemPrompt}\n\n${contextSummary}`,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as AnthropicMessage

      const content = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text || '')
        .join('')

      // Calculate approximate cost (Claude 3.5 Haiku pricing)
      const inputCost = (data.usage.input_tokens / 1_000_000) * 0.25
      const outputCost = (data.usage.output_tokens / 1_000_000) * 1.25

      return {
        content,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          model: this.model,
          cost: inputCost + outputCost,
        },
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Make an AI call with tool use
   */
  protected async callAIWithTools(
    systemPrompt: string,
    userMessage: string,
    context: AgentContext,
    availableTools: string[]
  ): Promise<{
    content: string
    toolCalls: Array<{ name: string; input: Record<string, unknown> }>
    usage: TokenUsage
  }> {
    // Convert our tools to Anthropic tool format
    const anthropicTools = availableTools
      .map((toolName) => this.tools.get(toolName))
      .filter((tool): tool is AgentTool => tool !== undefined)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object' as const,
          properties: tool.parameters.reduce(
            (acc, param) => {
              acc[param.name] = {
                type: param.type,
                description: param.description,
              }
              return acc
            },
            {} as Record<string, { type: string; description: string }>
          ),
          required: tool.parameters
            .filter((p) => p.required)
            .map((p) => p.name),
        },
      }))

    const contextSummary = this.buildContextSummary(context)

    // 30-second timeout to prevent hanging requests
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
          system: `${systemPrompt}\n\n${contextSummary}`,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
          tools: anthropicTools,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json() as AnthropicMessage

      let content = ''
      const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = []

      for (const block of data.content) {
        if (block.type === 'text') {
          content += block.text || ''
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            name: block.name || '',
            input: block.input || {},
          })
        }
      }

      const inputCost = (data.usage.input_tokens / 1_000_000) * 0.25
      const outputCost = (data.usage.output_tokens / 1_000_000) * 1.25

      return {
        content,
        toolCalls,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          model: this.model,
          cost: inputCost + outputCost,
        },
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Build a context summary for the AI
   */
  private buildContextSummary(context: AgentContext): string {
    const { memory } = context
    const parts: string[] = []

    if (memory.userPreferences) {
      parts.push(`User Preferences:
- Dietary restrictions: ${memory.userPreferences.dietaryRestrictions.join(', ') || 'None'}
- Favorite cuisines: ${memory.userPreferences.favoriteCuisines.join(', ') || 'Not specified'}
- Household size: ${memory.userPreferences.householdSize}
- Kid-friendly required: ${memory.userPreferences.kidFriendlyRequired}`)
    }

    if (memory.recentRecipes.length > 0) {
      parts.push(`Recent Recipes (${memory.recentRecipes.length}):
${memory.recentRecipes
  .slice(0, 5)
  .map((r) => `- ${r.name} (${r.cuisine || 'unknown cuisine'})`)
  .join('\n')}`)
    }

    if (memory.leftovers.length > 0) {
      parts.push(`Active Leftovers:
${memory.leftovers.map((l) => `- ${l.meal_name}: ${l.servings_remaining} servings (expires ${l.expiry_date})`).join('\n')}`)
    }

    if (memory.activePlan) {
      parts.push(`Active Meal Plan: Week of ${memory.activePlan.week_start}`)
    }

    return parts.length > 0
      ? `<context>\n${parts.join('\n\n')}\n</context>`
      : ''
  }

  /**
   * Create a message to send to another agent
   */
  protected createMessage(
    to: AgentType,
    action: string,
    payload: Record<string, unknown>,
    context: AgentContext
  ) {
    return {
      id: crypto.randomUUID(),
      from: this.name,
      to,
      type: 'request' as const,
      action,
      payload,
      context,
      timestamp: Date.now(),
    }
  }

  /**
   * Parse JSON from AI response (handles markdown code blocks)
   */
  protected parseJSON<T>(text: string): T | null {
    try {
      // Try direct parse first
      return JSON.parse(text) as T
    } catch {
      // Try extracting from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim()) as T
        } catch {
          return null
        }
      }
      return null
    }
  }

  /**
   * Get agent info for debugging
   */
  getInfo(): { name: AgentType; description: string; tools: string[] } {
    return {
      name: this.name,
      description: this.description,
      tools: Array.from(this.tools.keys()),
    }
  }
}
