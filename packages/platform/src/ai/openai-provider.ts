/**
 * OpenAI Provider
 *
 * Implements the AIProvider interface using the OpenAI chat completions API.
 * Uses raw fetch() instead of the OpenAI SDK to avoid adding a heavy
 * dependency for what is essentially one HTTP POST call.
 *
 * Security:
 *   - API key is never exposed to the frontend (server-side only)
 *   - Responses are treated as untrusted input (parsed via Zod by the caller)
 *   - Request timeouts prevent hanging on slow responses
 */

import type { AIProvider, AIMessage, AIRequestOptions } from "./provider.js";

/** Default model — cost-effective for structured tasks */
const DEFAULT_MODEL = "gpt-4o-mini";

/** Response timeout in milliseconds */
const TIMEOUT_MS = 30_000;

export class OpenAIProvider implements AIProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
    this.name = `openai:${this.model}`;
  }

  async complete(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0,
    };

    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options?.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(
          `OpenAI API error (${res.status}): ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data?.choices?.[0]?.message?.content;

      if (typeof content !== "string") {
        throw new Error("OpenAI returned an unexpected response shape");
      }

      return content;
    } finally {
      clearTimeout(timeout);
    }
  }
}
