/**
 * AgentChat Component
 *
 * A chat interface for interacting with the multi-agent AI system.
 * Can be used as a floating widget, sidebar, or full-page component.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bot,
  Send,
  X,
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Trash2,
} from 'lucide-react'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { useAgent, useAgentFeedback, AgentMessage } from '../../../hooks/useAgent'

interface AgentChatProps {
  // Display mode
  mode?: 'floating' | 'sidebar' | 'fullpage'

  // Initial conversation ID (for resuming)
  conversationId?: string

  // Callback when actions are received
  onAction?: (action: { type: string; payload: Record<string, unknown> }) => void

  // Custom placeholder
  placeholder?: string

  // Show/hide controls
  showHeader?: boolean
  showClearButton?: boolean

  // Custom class names
  className?: string
  messagesClassName?: string

  // Context hints for the AI
  contextHints?: string[]
}

// Quick action suggestions
const quickActions = [
  { label: 'Plan my week', icon: Sparkles },
  { label: "What's for dinner?", icon: MessageSquare },
  { label: 'Add a recipe', icon: Bot },
  { label: 'Shopping list', icon: Bot },
]

export function AgentChat({
  mode = 'floating',
  conversationId: initialConversationId,
  onAction,
  placeholder = 'Ask me anything about meal planning...',
  showHeader = true,
  showClearButton = true,
  className,
  messagesClassName,
  contextHints,
}: AgentChatProps) {
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(mode !== 'floating')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    isProcessing,
    sendMessage,
    clearConversation,
    cancelRequest,
  } = useAgent({
    conversationId: initialConversationId,
    onAction,
  })

  const feedbackMutation = useAgentFeedback()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle send
  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return

    const metadata = contextHints?.length
      ? { contextHints }
      : undefined

    sendMessage(input.trim(), metadata)
    setInput('')
  }, [input, isProcessing, sendMessage, contextHints])

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Handle quick action
  const handleQuickAction = (action: string) => {
    sendMessage(action)
  }

  // Copy message content
  const handleCopy = async (message: AgentMessage) => {
    await navigator.clipboard.writeText(message.content)
    setCopiedId(message.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Custom components for ReactMarkdown to maintain existing styling
  const markdownComponents = {
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="font-semibold text-base mt-3 mb-1">{children}</h3>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="font-semibold mt-2 mb-1">{children}</h4>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="font-semibold mt-2 mb-1">{children}</h4>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-1">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc ml-4 mb-1">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal ml-4 mb-1">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="ml-1">{children}</li>
    ),
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-600 dark:text-violet-400 hover:underline"
      >
        {children}
      </a>
    ),
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      // Check if this is a code block (has language class) or inline code
      const isCodeBlock = className?.includes('language-')
      if (isCodeBlock) {
        return (
          <pre className="bg-gray-800 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">
            <code className={className}>{children}</code>
          </pre>
        )
      }
      return (
        <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">
          {children}
        </code>
      )
    },
    pre: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-violet-300 dark:border-violet-600 pl-3 my-2 italic">
        {children}
      </blockquote>
    ),
  }

  // Render message content using ReactMarkdown (XSS-safe)
  const renderMessageContent = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    )
  }

  // Floating button (for floating mode)
  if (mode === 'floating' && !isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 z-50"
      >
        <Bot className="h-6 w-6 text-white" />
      </Button>
    )
  }

  // Container classes based on mode
  const containerClasses = cn(
    'flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl border',
    {
      'fixed bottom-6 right-6 w-96 h-[600px] z-50': mode === 'floating',
      'h-full w-full': mode === 'sidebar' || mode === 'fullpage',
    },
    className
  )

  return (
    <div className={containerClasses}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Meal Planning Assistant
              </h3>
              <p className="text-xs text-gray-500">
                Powered by AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {showClearButton && messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {mode === 'floating' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className={cn(
          'flex-1 overflow-y-auto p-4 space-y-4',
          messagesClassName
        )}
      >
        {/* Welcome message when empty */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="p-4 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900 rounded-full mb-4">
              <Sparkles className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
              How can I help you today?
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              I can help you plan meals, save recipes, analyze nutrition, and
              create shopping lists.
            </p>

            {/* Quick actions */}
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action.label)}
                  className="text-xs"
                >
                  <action.icon className="h-3 w-3 mr-1" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex gap-3', {
              'justify-end': message.role === 'user',
            })}
          >
            {/* Avatar for assistant */}
            {message.role !== 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}

            {/* Message bubble */}
            <div
              className={cn('max-w-[80%] rounded-2xl px-4 py-2', {
                'bg-violet-600 text-white': message.role === 'user',
                'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white':
                  message.role !== 'user',
              })}
            >
              {message.isLoading ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              ) : (
                <div className="text-sm leading-relaxed">
                  {renderMessageContent(message.content)}
                </div>
              )}

              {/* Actions for assistant messages */}
              {message.role !== 'user' && !message.isLoading && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(message)}
                  >
                    {copiedId === message.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-400" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => feedbackMutation.mutate({ messageId: message.id, feedbackType: 'helpful' })}
                  >
                    <ThumbsUp className="h-3 w-3 text-gray-400" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => feedbackMutation.mutate({ messageId: message.id, feedbackType: 'not_helpful' })}
                  >
                    <ThumbsDown className="h-3 w-3 text-gray-400" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t">
        {isProcessing && (
          <div className="flex justify-center mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelRequest}
              className="text-xs text-gray-500"
            >
              Cancel
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isProcessing}
              rows={1}
              className={cn(
                'w-full resize-none rounded-xl border px-4 py-3 pr-12',
                'focus:outline-none focus:ring-2 focus:ring-violet-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'text-sm'
              )}
              style={{
                minHeight: '48px',
                maxHeight: '120px',
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className={cn(
                'absolute right-2 bottom-2 h-8 w-8 rounded-lg',
                'bg-violet-600 hover:bg-violet-700 disabled:opacity-50'
              )}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-2">
          AI can make mistakes. Verify important info.
        </p>
      </div>
    </div>
  )
}

export default AgentChat
