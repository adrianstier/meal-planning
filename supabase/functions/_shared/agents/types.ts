/**
 * Multi-Agent Framework Type Definitions
 *
 * This module defines the core types for the meal planning multi-agent system.
 */

// Agent identifiers
export type AgentType =
  | 'orchestrator'
  | 'recipe'
  | 'planning'
  | 'nutrition'
  | 'shopping'

// Message types for inter-agent communication
export type MessageType = 'request' | 'response' | 'event' | 'error'

// Task status for async operations
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

/**
 * Core message structure for agent communication
 */
export interface AgentMessage {
  id: string
  from: AgentType
  to: AgentType
  type: MessageType
  action: string
  payload: Record<string, unknown>
  context: AgentContext
  timestamp: number
}

/**
 * Shared context passed between agents
 */
export interface AgentContext {
  userId: string
  conversationId: string
  parentMessageId?: string
  memory: SharedMemory
  metadata: Record<string, unknown>
}

/**
 * Shared memory accessible by all agents
 */
export interface SharedMemory {
  userPreferences: UserPreferences | null
  recentRecipes: Recipe[]
  activePlan: MealPlan | null
  leftovers: Leftover[]
  conversationHistory: ConversationMessage[]
}

/**
 * User preferences loaded from database
 */
export interface UserPreferences {
  dietaryRestrictions: string[]
  favoriteCuisines: string[]
  dislikedIngredients: string[]
  householdSize: number
  kidFriendlyRequired: boolean
  budgetLevel: 'low' | 'medium' | 'high'
  mealPrepDay: string | null
  nutritionGoals: NutritionGoals | null
}

export interface NutritionGoals {
  dailyCalories: number | null
  proteinGrams: number | null
  carbsGrams: number | null
  fatGrams: number | null
  fiberGrams: number | null
}

/**
 * Recipe structure (matches database schema)
 */
export interface Recipe {
  id: string
  name: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ingredients: string
  instructions: string
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  cuisine: string | null
  tags: string | null
  notes: string | null
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  kid_friendly_level: number | null
  makes_leftovers: boolean
  leftover_days: number | null
  source_url: string | null
  image_url: string | null
  is_favorite: boolean
  created_at: string
}

/**
 * Meal plan structure
 */
export interface MealPlan {
  id: string
  week_start: string
  meals: ScheduledMeal[]
}

export interface ScheduledMeal {
  id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  meal_id: string | null
  meal: Recipe | null
  servings: number
  notes: string | null
}

/**
 * Leftover tracking
 */
export interface Leftover {
  id: string
  meal_id: string
  meal_name: string
  servings_remaining: number
  created_date: string
  /** Maps to `expires_date` column in database */
  expiry_date: string
}

/**
 * Conversation message for history
 */
export interface ConversationMessage {
  id: string
  role: 'user' | AgentType
  content: string
  timestamp: number
}

/**
 * Tool definition for agent capabilities
 */
export interface AgentTool {
  name: string
  description: string
  parameters: ToolParameter[]
  execute: (params: Record<string, unknown>, context: AgentContext) => Promise<ToolResult>
}

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  default?: unknown
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Agent response structure
 */
export interface AgentResponse {
  success: boolean
  message: string
  data?: Record<string, unknown>
  actions?: AgentAction[]
  nextAgent?: AgentType
  error?: string
}

/**
 * Actions an agent can request
 */
export interface AgentAction {
  type: 'save_recipe' | 'update_plan' | 'add_to_list' | 'update_preferences' | 'log_feedback'
  payload: Record<string, unknown>
}

/**
 * Intent classification result from orchestrator
 */
export interface IntentClassification {
  primaryIntent: Intent
  secondaryIntents: Intent[]
  confidence: number
  entities: ExtractedEntity[]
}

export type Intent =
  | 'parse_recipe'
  | 'save_recipe'
  | 'plan_meals'
  | 'suggest_meal'
  | 'analyze_nutrition'
  | 'generate_shopping_list'
  | 'check_leftovers'
  | 'get_substitution'
  | 'general_question'
  | 'unknown'

export interface ExtractedEntity {
  type: 'url' | 'recipe_name' | 'ingredient' | 'date' | 'meal_type' | 'cuisine' | 'dietary'
  value: string
  confidence: number
}

/**
 * Database task for async operations
 */
export interface AgentTask {
  id: string
  user_id: string
  agent: AgentType
  action: string
  payload: Record<string, unknown>
  status: TaskStatus
  result: Record<string, unknown> | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  error: string | null
}

/**
 * Feedback for learning
 */
export interface AgentFeedback {
  messageId: string
  rating: 1 | 2 | 3 | 4 | 5
  comment?: string
  corrections?: Record<string, unknown>
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model: string
  cost: number
}

/**
 * Agent execution result with metadata
 */
export interface AgentExecutionResult {
  response: AgentResponse
  tokenUsage: TokenUsage
  executionTimeMs: number
  agentChain: AgentType[]
}
