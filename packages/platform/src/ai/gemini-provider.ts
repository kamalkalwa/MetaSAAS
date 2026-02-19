/**
 * Google Gemini Provider
 *
 * Implements the AIProvider interface using the Google Gemini REST API.
 * Uses raw fetch() instead of the @google/generative-ai SDK to avoid
 * adding a dependency for what is essentially one HTTP POST call.
 *
 * API reference:
 *   https://ai.google.dev/api/generate-content
 *
 * Key differences from OpenAI:
 *   - System instructions are a separate top-level field, not a message role
 *   - Assistant messages use role "model" instead of "assistant"
 *   - JSON mode uses generationConfig.responseMimeType
 *   - Auth uses x-goog-api-key header (not Bearer token)
 *
 * Security:
 *   - API key is never exposed to the frontend (server-side only)
 *   - Responses are treated as untrusted input (parsed via Zod by the caller)
 *   - Request timeouts prevent hanging on slow responses
 */

import type { AIProvider, AIMessage, AIRequestOptions } from "./provider.js";

/** Default model — fast and cost-effective for structured tasks */
const DEFAULT_MODEL = "gemini-2.0-flash";

/** Response timeout in milliseconds */
const TIMEOUT_MS = 30_000;

/** Gemini API base URL */
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiProvider implements AIProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_MODEL;
    this.name = `gemini:${this.model}`;
  }

  async complete(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<string> {
    // Separate system messages from conversation messages.
    // Gemini uses a dedicated systemInstruction field for system prompts.
    const systemParts = messages
      .filter((m) => m.role === "system")
      .map((m) => ({ text: m.content }));

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = { contents };

    // Attach system instruction if any system messages exist
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: systemParts };
    }

    // Build generation config (temperature, max tokens, JSON mode)
    const generationConfig: Record<string, unknown> = {
      temperature: options?.temperature ?? 0,
    };

    if (options?.maxTokens) {
      generationConfig.maxOutputTokens = options.maxTokens;
    }

    if (options?.responseFormat === "json") {
      generationConfig.responseMimeType = "application/json";
    }

    body.generationConfig = generationConfig;

    const url = `${API_BASE}/${this.model}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(
          `Gemini API error (${res.status}): ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (typeof text !== "string") {
        throw new Error("Gemini returned an unexpected response shape");
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }
}
