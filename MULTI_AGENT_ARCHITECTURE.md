# Multi-Agent Framework Architecture

## Overview

This document describes the multi-agent AI system for the Meal Planning SaaS. The framework coordinates specialized AI agents that work together to handle recipe scraping, meal planning, nutrition analysis, and shopping list generation.

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR AGENT                                 │
│  Coordinates all agents, manages workflow, handles user intent routing       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  RECIPE AGENT   │       │ PLANNING AGENT  │       │ NUTRITION AGENT │
│                 │       │                 │       │                 │
│ • URL Scraping  │       │ • Weekly Plans  │       │ • Macro Analysis│
│ • Text Parsing  │       │ • Meal Matching │       │ • Diet Goals    │
│ • Image OCR     │       │ • Family Prefs  │       │ • Allergen Flags│
│ • Validation    │       │ • Leftover Use  │       │ • Substitutions │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │    SHOPPING AGENT       │
                    │                         │
                    │ • List Generation       │
                    │ • Store Optimization    │
                    │ • Ingredient Grouping   │
                    │ • Budget Estimation     │
                    └─────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MEMORY LAYER                                       │
│  Shared context, user preferences, conversation history, learned patterns    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Agent Definitions

### 1. Orchestrator Agent
**Role**: Central coordinator that routes requests to specialized agents

**Responsibilities**:
- Parse user intent from natural language
- Determine which agent(s) to invoke
- Coordinate multi-agent workflows
- Aggregate and format responses
- Manage conversation context

**Triggers**:
- All user interactions start here
- Agents can request orchestrator to invoke other agents

### 2. Recipe Agent
**Role**: Extract, parse, and validate recipes from any source

**Capabilities**:
- **URL Scraping**: Fetch and parse recipe websites (JSON-LD, HTML parsing)
- **Text Parsing**: Convert raw recipe text to structured data
- **Image OCR**: Extract recipes from photos (cookbooks, handwritten)
- **Validation**: Ensure completeness, fix common errors
- **Enrichment**: Add missing nutrition, timing estimates

**Tools Available**:
- `scrape_url` - Fetch webpage content
- `extract_json_ld` - Parse structured data
- `parse_with_ai` - Claude-powered extraction
- `validate_recipe` - Schema validation
- `estimate_nutrition` - Calculate macros from ingredients

### 3. Planning Agent
**Role**: Generate intelligent meal plans based on constraints

**Capabilities**:
- **Weekly Planning**: Generate 7-day meal schedules
- **Constraint Handling**: Dietary restrictions, preferences, budget
- **Leftover Integration**: Schedule meals to use leftovers
- **Family Optimization**: Balance kid-friendly with adult preferences
- **Variety Balancing**: Avoid repetition, ensure cuisine diversity

**Tools Available**:
- `query_recipes` - Search user's recipe database
- `check_leftovers` - Query active leftovers
- `get_preferences` - Load family preferences
- `score_meal` - Rate meal fit for slot
- `generate_plan` - Create weekly schedule

### 4. Nutrition Agent
**Role**: Analyze and optimize nutritional content

**Capabilities**:
- **Macro Calculation**: Calculate daily/weekly macros
- **Goal Tracking**: Compare to user's nutrition goals
- **Allergen Detection**: Flag potential allergens
- **Substitution Suggestions**: Healthier ingredient swaps
- **Diet Compliance**: Check keto, vegetarian, etc.

**Tools Available**:
- `calculate_macros` - Sum nutrition from ingredients
- `check_allergens` - Scan for common allergens
- `suggest_substitutes` - Find healthier alternatives
- `analyze_diet_fit` - Score against dietary goals

### 5. Shopping Agent
**Role**: Generate optimized shopping lists

**Capabilities**:
- **List Generation**: Aggregate ingredients from meal plan
- **Deduplication**: Combine similar items
- **Category Grouping**: Organize by store aisle
- **Quantity Scaling**: Adjust for servings/family size
- **Budget Estimation**: Approximate costs

**Tools Available**:
- `aggregate_ingredients` - Combine from multiple recipes
- `normalize_units` - Convert to standard units
- `group_by_category` - Organize by food type
- `estimate_cost` - Calculate approximate prices

---

## Communication Protocol

### Message Format

```typescript
interface AgentMessage {
  id: string
  from: AgentType
  to: AgentType
  type: 'request' | 'response' | 'event' | 'error'
  action: string
  payload: Record<string, unknown>
  context: AgentContext
  timestamp: number
}

interface AgentContext {
  userId: string
  conversationId: string
  parentMessageId?: string
  memory: SharedMemory
  metadata: Record<string, unknown>
}

interface SharedMemory {
  userPreferences: UserPreferences
  recentRecipes: Recipe[]
  activePlan: MealPlan | null
  leftovers: Leftover[]
  conversationHistory: Message[]
}
```

### Workflow Examples

#### Example 1: "Plan my week with these recipes I'm saving"

```
User → Orchestrator: "Plan my week using the recipes I just added"
         │
         ├─→ Orchestrator analyzes intent: PLAN_WEEK + RECENT_RECIPES
         │
         ├─→ Orchestrator → Recipe Agent: "Get recently added recipes"
         │   Recipe Agent → Orchestrator: [list of 5 recipes]
         │
         ├─→ Orchestrator → Planning Agent: "Generate week plan"
         │   │   Context: recipes, family prefs, existing leftovers
         │   │
         │   ├─→ Planning Agent → Nutrition Agent: "Validate weekly balance"
         │   │   Nutrition Agent → Planning Agent: "Low protein on Wed"
         │   │
         │   └─→ Planning Agent adjusts, returns plan
         │
         └─→ Orchestrator → User: Formatted weekly meal plan
```

#### Example 2: "Save this recipe and add ingredients to my list"

```
User → Orchestrator: [Recipe URL] "Save this and add to shopping list"
         │
         ├─→ Orchestrator → Recipe Agent: "Parse and save recipe"
         │   Recipe Agent: Scrapes, validates, saves to DB
         │   Recipe Agent → Orchestrator: Parsed recipe
         │
         ├─→ Orchestrator → Shopping Agent: "Add ingredients to list"
         │   Shopping Agent: Normalizes, dedupes with existing
         │   Shopping Agent → Orchestrator: Updated list
         │
         └─→ Orchestrator → User: "Saved! Added 12 items to list"
```

---

## State Management

### Agent State

Each agent maintains:
- **Working Memory**: Current task context
- **Tool Results**: Cached responses from tools
- **Error State**: Failed operations to retry/report

### Shared State (Memory Layer)

Persisted in Supabase:
- `agent_conversations` - Conversation history
- `agent_memory` - Learned user patterns
- `agent_tasks` - Async task queue

```sql
-- Conversation tracking
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active'
);

-- Message history
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES agent_conversations(id),
  role TEXT NOT NULL, -- 'user', 'orchestrator', 'recipe', 'planning', etc.
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learned patterns
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  memory_type TEXT NOT NULL, -- 'preference', 'pattern', 'feedback'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, memory_type, key)
);

-- Background tasks
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);
```

---

## Implementation Strategy

### Phase 1: Core Framework
1. Agent base class with tool execution
2. Orchestrator with intent classification
3. Message passing infrastructure
4. Memory layer integration

### Phase 2: Specialized Agents
1. Recipe Agent (enhance existing Edge Functions)
2. Planning Agent (upgrade current generation logic)
3. Nutrition Agent (new capability)
4. Shopping Agent (enhance current list generation)

### Phase 3: Advanced Features
1. Async task processing
2. Learning from user feedback
3. Proactive suggestions
4. Multi-user household coordination

---

## Technology Stack

- **Runtime**: Supabase Edge Functions (Deno)
- **AI Provider**: Anthropic Claude (claude-3-5-sonnet for complex, haiku for simple)
- **State**: Supabase PostgreSQL + RLS
- **Queue**: Supabase Edge Functions + pg_cron for async
- **Frontend**: React hooks for agent interaction

---

## API Design

### REST Endpoints

```
POST /functions/v1/agent
  Body: { action: string, payload: object, conversationId?: string }
  Response: { result: object, conversationId: string }

GET /functions/v1/agent/tasks/:taskId
  Response: { status: string, result?: object }

POST /functions/v1/agent/feedback
  Body: { messageId: string, rating: number, comment?: string }
```

### WebSocket (Future)
For real-time streaming responses and agent status updates.

---

## Security Considerations

1. **Authentication**: All agent calls require valid JWT
2. **Rate Limiting**: Per-user, per-agent limits
3. **Input Validation**: Sanitize all user inputs
4. **Output Filtering**: Remove sensitive data from responses
5. **Cost Control**: Token budgets per user tier
6. **Audit Logging**: Track all agent actions

---

## Metrics & Monitoring

Track:
- Agent invocation counts
- Response times per agent
- Token usage and costs
- Error rates
- User satisfaction (feedback)
- Task completion rates
