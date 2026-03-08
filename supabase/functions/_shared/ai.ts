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
    maxTokens = 4000,
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
    const text = data.content?.[0]?.text;
    if (!text) {
      throw new Error("AI returned empty response");
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again.');
    }
    throw error;
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
 * Call Claude with one or more images + text prompt (vision). Returns the response text and usage stats.
 */
export async function callClaudeVision(
  system: string,
  user: string,
  imageData: string | string[],
  mediaType: string | string[],
  apiKey: string,
  options: CallClaudeOptions = {},
): Promise<VisionResult> {
  const {
    model = CLAUDE_VISION_MODEL,
    maxTokens = 4096,
    timeoutMs = 30000,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Build content array with one or more images
  const images = Array.isArray(imageData) ? imageData : [imageData];
  const types = Array.isArray(mediaType) ? mediaType : [mediaType];
  const content: Array<Record<string, unknown>> = images.map((data, i) => ({
    type: "image",
    source: { type: "base64", media_type: types[i] || types[0], data },
  }));
  content.push({ type: "text", text: user });

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
        messages: [{ role: "user", content }],
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
    const text = data.content?.[0]?.text;
    if (!text) {
      throw new Error("AI returned empty response");
    }
    return {
      text,
      usage: data.usage,
      model: data.model,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract JSON from Claude's response text. Handles markdown fences and bare JSON.
 * Uses balanced-brace matching to avoid greedy regex issues.
 */
export function extractJSON<T>(text: string): T | null {
  // Try fenced code blocks first
  const fencePatterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
  ];

  for (const pattern of fencePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as T;
      } catch {
        continue;
      }
    }
  }

  // Find first { or [ and match to balanced closing } or ]
  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  // Pick whichever comes first; -1 means not found
  const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
  if (start === -1) return null;

  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.substring(start, i + 1)) as T;
          } catch {
            // Try finding next open char after current position
            const nextStart = text.indexOf(openChar, i + 1);
            if (nextStart === -1) return null;
            i = nextStart - 1;
            depth = 0;
            inString = false;
            continue;
          }
        }
      }
    }
  }
  return null;
}
