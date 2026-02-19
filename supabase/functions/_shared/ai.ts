// Shared Claude AI utilities for Edge Functions

import { handleAnthropicError, logError } from "./cors.ts";

// Current model IDs — update here when new models release
export const CLAUDE_TEXT_MODEL = "claude-haiku-4-5-20251001";
export const CLAUDE_VISION_MODEL = "claude-sonnet-4-5-20250929";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface CallClaudeOptions {
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Call Claude with a text-only prompt. Returns the response text.
 */
export async function callClaude(
  system: string,
  user: string,
  apiKey: string,
  options: CallClaudeOptions = {},
): Promise<string> {
  const {
    model = CLAUDE_TEXT_MODEL,
    maxTokens = 2000,
    timeoutMs = 30000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      const { userMessage } = handleAnthropicError(response, errorData);
      logError({ event: "claude_api_error", status: response.status, model, error: errorData?.error?.message });
      throw new Error(userMessage);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  } finally {
    clearTimeout(timeoutId);
  }
}

interface VisionResult {
  text: string;
  usage?: { input_tokens: number; output_tokens: number };
  model?: string;
}

/**
 * Call Claude with an image + text prompt (vision). Returns the response text and usage stats.
 */
export async function callClaudeVision(
  system: string,
  user: string,
  imageData: string,
  mediaType: string,
  apiKey: string,
  options: CallClaudeOptions = {},
): Promise<VisionResult> {
  const {
    model = CLAUDE_VISION_MODEL,
    maxTokens = 2048,
    timeoutMs = 30000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageData },
              },
              { type: "text", text: user },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      const { userMessage } = handleAnthropicError(response, errorData);
      logError({ event: "claude_vision_error", status: response.status, model, error: errorData?.error?.message });
      throw new Error(userMessage);
    }

    const data = await response.json();
    return {
      text: data.content?.[0]?.text || "",
      usage: data.usage,
      model: data.model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract JSON from Claude's response text. Handles markdown fences and bare JSON.
 */
export function extractJSON<T>(text: string): T | null {
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /(\{[\s\S]*\})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as T;
      } catch {
        continue;
      }
    }
  }
  return null;
}
