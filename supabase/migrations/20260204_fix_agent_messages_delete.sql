-- Add DELETE policy for agent_messages
-- This policy was missing, preventing users from deleting messages in their own conversations

CREATE POLICY "Users can delete messages in own conversations"
  ON agent_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM agent_conversations
      WHERE agent_conversations.id = agent_messages.conversation_id
      AND agent_conversations.user_id = auth.uid()
    )
  );
