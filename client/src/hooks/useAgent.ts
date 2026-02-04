/**
 * useAgent Hook
 *
 * React hook for interacting with the multi-agent AI system.
 * Provides methods for sending messages, managing conversations,
 * and handling streaming responses.
 */

import { useState, useCallback, useRef } from 'react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase, supabaseUrl } from '../lib/supabase'

// Types
export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  data?: Record<string, unknown>
  timestamp: number
  isLoading?: boolean
}

export interface AgentResponse {
  success: boolean
  message: string
  data?: Record<string, unknown>
  actions?: Array<{
    type: string
    payload: Record<string, unknown>
  }>
  conversationId: string
  executionTimeMs?: number
  error?: string
}

export interface AgentConversation {
  id: string
  title: string
  lastMessage: string
  lastMessageAt: string
  status: 'active' | 'archived'
}

export interface UseAgentOptions {
  conversationId?: string
  onAction?: (action: { type: string; payload: Record<string, unknown> }) => void
  onError?: (error: Error) => void
}

// Constants
const MAX_MESSAGE_LENGTH = 10000
const REQUEST_TIMEOUT_MS = 30000

/**
 * Call the agent Edge Function
 */
async function callAgent(
  message: string,
  conversationId?: string,
  metadata?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<AgentResponse> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/agent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message,
        conversationId,
        metadata,
      }),
      signal,
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Agent request failed')
  }

  return response.json()
}

/**
 * Main hook for agent interactions
 */
export function useAgent(options: UseAgentOptions = {}) {
  const { onAction, onError } = options

  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>(
    options.conversationId
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isUserCancelledRef = useRef(false)
  const isTimeoutRef = useRef(false)

  const queryClient = useQueryClient()

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      message,
      metadata,
    }: {
      message: string
      metadata?: Record<string, unknown>
    }) => {
      // Validate message length
      if (message.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`)
      }

      // Create AbortController with timeout
      const controller = new AbortController()
      abortControllerRef.current = controller
      isUserCancelledRef.current = false
      isTimeoutRef.current = false

      // Set up timeout to abort the request
      const timeoutId = setTimeout(() => {
        isTimeoutRef.current = true
        controller.abort()
      }, REQUEST_TIMEOUT_MS)

      try {
        const result = await callAgent(message, conversationId, metadata, controller.signal)
        return result
      } finally {
        // Clean up timeout and ref
        clearTimeout(timeoutId)
        isTimeoutRef.current = false
        abortControllerRef.current = null
      }
    },
    onMutate: async ({ message }) => {
      // Optimistically add user message
      const userMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
      }

      // Add loading message for assistant
      const loadingMessage: AgentMessage = {
        id: 'loading',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isLoading: true,
      }

      setMessages((prev) => [...prev, userMessage, loadingMessage])
      setIsProcessing(true)
    },
    onSuccess: (response) => {
      // Remove loading message and add real response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== 'loading')
        const assistantMessage: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.message,
          data: response.data,
          timestamp: Date.now(),
        }
        return [...filtered, assistantMessage]
      })

      // Update conversation ID
      if (response.conversationId) {
        setConversationId(response.conversationId)
      }

      // Handle actions
      if (response.actions && onAction) {
        for (const action of response.actions) {
          onAction(action)
        }
      }

      // Invalidate relevant queries based on actions
      if (response.actions) {
        for (const action of response.actions) {
          switch (action.type) {
            case 'save_recipe':
              queryClient.invalidateQueries({ queryKey: ['meals'] })
              break
            case 'update_plan':
              queryClient.invalidateQueries({ queryKey: ['weekPlan'] })
              break
            case 'add_to_list':
              queryClient.invalidateQueries({ queryKey: ['shoppingItems'] })
              break
          }
        }
      }

      setIsProcessing(false)
    },
    onError: (error: Error) => {
      // Clear the abort controller ref on error
      abortControllerRef.current = null

      // Check if this was a user-initiated cancellation or timeout
      const wasUserCancelled = isUserCancelledRef.current
      const wasTimeout = isTimeoutRef.current
      isUserCancelledRef.current = false
      isTimeoutRef.current = false

      // Remove loading message and add error (unless it was a user cancellation)
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== 'loading')

        // Don't add error message if request was cancelled by user
        if (wasUserCancelled) {
          return filtered
        }

        // Provide a user-friendly message for timeout vs other errors
        const errorContent = wasTimeout
          ? 'Request timed out. Please try again.'
          : `Sorry, I encountered an error: ${error.message}`

        const errorMessage: AgentMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorContent,
          timestamp: Date.now(),
        }
        return [...filtered, errorMessage]
      })

      setIsProcessing(false)

      if (onError) {
        onError(error)
      }
    },
  })

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(
    (message: string, metadata?: Record<string, unknown>) => {
      const trimmedMessage = message.trim()
      if (!trimmedMessage || isProcessing) return

      // Client-side validation for message length
      if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
        const error = new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`)
        if (onError) {
          onError(error)
        }
        return
      }

      sendMessageMutation.mutate({ message: trimmedMessage, metadata })
    },
    [sendMessageMutation, isProcessing, onError]
  )

  /**
   * Clear conversation history
   */
  const clearConversation = useCallback(() => {
    setMessages([])
    setConversationId(undefined)
  }, [])

  /**
   * Cancel current request
   */
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      isUserCancelledRef.current = true
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setMessages((prev) => prev.filter((m) => m.id !== 'loading'))
    setIsProcessing(false)
  }, [])

  /**
   * Add a system message
   */
  const addSystemMessage = useCallback((content: string) => {
    const systemMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, systemMessage])
  }, [])

  return {
    messages,
    conversationId,
    isProcessing,
    sendMessage,
    clearConversation,
    cancelRequest,
    addSystemMessage,
    error: sendMessageMutation.error,
  }
}

/**
 * Hook to fetch conversation history
 */
export function useConversationHistory(conversationId?: string) {
  return useQuery({
    queryKey: ['agentConversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null

      const { data, error } = await supabase
        .from('agent_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return data.map((msg) => ({
        id: msg.id,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        data: msg.tool_results,
        timestamp: new Date(msg.created_at).getTime(),
      })) as AgentMessage[]
    },
    enabled: !!conversationId,
  })
}

/**
 * Hook to list user's conversations
 */
export function useConversations() {
  return useQuery({
    queryKey: ['agentConversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_conversations')
        .select(`
          id,
          title,
          last_message_at,
          status,
          agent_messages!inner(content)
        `)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(20)

      if (error) throw error

      return data.map((conv) => ({
        id: conv.id,
        title: conv.title || 'Conversation',
        lastMessage: conv.agent_messages?.[0]?.content || '',
        lastMessageAt: conv.last_message_at,
        status: conv.status,
      })) as AgentConversation[]
    },
  })
}

/**
 * Hook to submit feedback
 */
export function useAgentFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      messageId,
      rating,
      feedbackType,
      comment,
    }: {
      messageId: string
      rating?: number
      feedbackType?: 'helpful' | 'not_helpful' | 'incorrect' | 'offensive' | 'other'
      comment?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('agent_feedback').insert({
        user_id: user.id,
        message_id: messageId,
        rating,
        feedback_type: feedbackType,
        comment,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentFeedback'] })
    },
  })
}

export default useAgent
