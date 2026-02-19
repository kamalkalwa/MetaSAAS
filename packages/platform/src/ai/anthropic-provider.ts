/**
 * Anthropic (Claude) Provider
 *
 * Implements the AIProvider interface using the Anthropic Messages API.
 * Uses raw fetch() instead of the @anthropic-ai/sdk to avoid adding a
 * dependency for what is essentially one HTTP POST call.
 *
 * API reference:
 *   https://docs.anthropic.com/en/api/messages
 *
 * Key differences from OpenAI:
 *   - System message is a top-level field, not part of the messages array
 *   - Auth uses x-api-key header (not Bearer token)
 *   - Requires anthropic-version header
 *   - max_tokens is required (not optional)
 *   - Response shape uses content[].text instead of choices[].message.content
 *
 * Security:
 *   - API key is never exposed to the frontend (server-side only)
 *   - Responses are treated as untrusted input (parsed via Zod by the caller)
 *   - Request timeouts prevent hanging on slow responses
 */

import type { AIProvider, AIMessage, AIRequestOptions } from "./provider.js";

/** Default model — balanced quality and speed */
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/** Response timeout in milliseconds */
const TIMEOUT_MS = 30_000;

/** Anthropic API version — required header */
const API_VERSION = "2023-06-01";

/** Anthropic Messages API endpoint */
const API_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements AIProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
    this.name = `anthropic:${this.model}`;
  }

  async complete(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<string> {
    // Separate system messages — Anthropic uses a top-level "system" field.
    const systemText = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const body: Record<string, unknown> = {
      model: this.model,
      messages: conversationMessages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0,
    };

    // Attach system prompt if present
    if (systemText) {
      body.system = systemText;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(
          `Anthropic API error (${res.status}): ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await res.json()) as {
        content?: { type?: string; text?: string }[];
      };

      // Extract the first text block from the response
      const textBlock = data?.content?.find((b) => b.type === "text");

      if (!textBlock || typeof textBlock.text !== "string") {
        throw new Error("Anthropic returned an unexpected response shape");
      }

      return textBlock.text;
    } finally {
      clearTimeout(timeout);
    }
  }
}
