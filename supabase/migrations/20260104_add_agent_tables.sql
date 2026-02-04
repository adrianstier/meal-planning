-- Multi-Agent Framework Database Tables
-- Migration: Add agent conversation, message, memory, and task tracking tables

-- ============================================
-- Agent Conversations
-- ============================================
-- Tracks conversation sessions with the AI agent system
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  title TEXT, -- Auto-generated conversation title
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient user conversation lookups
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_status ON agent_conversations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message ON agent_conversations(user_id, last_message_at DESC);

-- RLS Policy
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON agent_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Agent Messages
-- ============================================
-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'orchestrator', 'recipe', 'planning', 'nutrition', 'shopping', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB, -- Tools invoked during this message
  tool_results JSONB, -- Results from tool invocations
  token_usage JSONB, -- Token usage for this message
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient message retrieval
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(conversation_id, created_at);

-- RLS Policy (through conversation ownership)
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON agent_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE agent_conversations.id = agent_messages.conversation_id
      AND agent_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations"
  ON agent_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE agent_conversations.id = agent_messages.conversation_id
      AND agent_conversations.user_id = auth.uid()
    )
  );

-- ============================================
-- Agent Memory
-- ============================================
-- Long-term memory storage for learned patterns and preferences
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'pattern', 'feedback', 'fact')),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT, -- Where this memory came from (conversation_id, user_input, inference)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration for temporary memories
  UNIQUE(user_id, memory_type, key)
);

-- Index for efficient memory lookups
CREATE INDEX IF NOT EXISTS idx_agent_memory_user_type ON agent_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_key ON agent_memory(user_id, key);

-- RLS Policy
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
  ON agent_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own memories"
  ON agent_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
  ON agent_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON agent_memory FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Agent Tasks
-- ============================================
-- Background task queue for async operations
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE SET NULL,
  agent TEXT NOT NULL CHECK (agent IN ('orchestrator', 'recipe', 'planning', 'nutrition', 'shopping')),
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error TEXT,
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for task management
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_status ON agent_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending ON agent_tasks(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent, status);

-- RLS Policy
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON agent_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON agent_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON agent_tasks FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Agent Feedback
-- ============================================
-- User feedback on agent responses for learning
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type TEXT CHECK (feedback_type IN ('helpful', 'not_helpful', 'incorrect', 'offensive', 'other')),
  comment TEXT,
  corrections JSONB, -- User-provided corrections to improve future responses
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for feedback analysis
CREATE INDEX IF NOT EXISTS idx_agent_feedback_user ON agent_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_rating ON agent_feedback(rating);

-- RLS Policy
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
  ON agent_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create feedback"
  ON agent_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Agent Usage Stats
-- ============================================
-- Track agent usage for analytics and billing
CREATE TABLE IF NOT EXISTS agent_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  agent TEXT NOT NULL,
  requests INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date, agent)
);

-- Index for usage queries
CREATE INDEX IF NOT EXISTS idx_agent_usage_user_date ON agent_usage(user_id, date DESC);

-- RLS Policy
ALTER TABLE agent_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON agent_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_conversations
  SET last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_message_at
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON agent_messages;
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Function to update agent_memory updated_at
CREATE OR REPLACE FUNCTION update_agent_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for memory timestamp updates
DROP TRIGGER IF EXISTS trigger_update_agent_memory_timestamp ON agent_memory;
CREATE TRIGGER trigger_update_agent_memory_timestamp
  BEFORE UPDATE ON agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_memory_timestamp();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE agent_conversations IS 'Tracks conversation sessions with the multi-agent AI system';
COMMENT ON TABLE agent_messages IS 'Individual messages within agent conversations';
COMMENT ON TABLE agent_memory IS 'Long-term memory storage for learned patterns and preferences';
COMMENT ON TABLE agent_tasks IS 'Background task queue for async agent operations';
COMMENT ON TABLE agent_feedback IS 'User feedback on agent responses for continuous improvement';
COMMENT ON TABLE agent_usage IS 'Track agent usage for analytics and cost management';
