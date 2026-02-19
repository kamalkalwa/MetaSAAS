/**
 * AI Provider Interface
 *
 * The single abstraction between the platform and AI models.
 * Follows Dependency Inversion (DIP): the platform depends on this
 * interface, not on any specific provider. Swapping OpenAI for
 * Anthropic means implementing this interface — nothing else changes.
 *
 * Design decisions:
 *   - Input is structured messages (not raw strings) for safety and auditability
 *   - Output is always a string — the caller parses it (with Zod schema)
 *   - Options are minimal: only what affects routing/behavior
 *   - Fallback is the caller's responsibility (AICapabilityDefinition.output.fallback)
 */

/** A single message in the AI conversation */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options that affect how the provider handles the request */
export interface AIRequestOptions {
  /** Expected output format — "json" tells the model to respond with valid JSON */
  responseFormat?: "text" | "json";
  /** Maximum tokens in the response (provider default if omitted) */
  maxTokens?: number;
  /** Temperature (0 = deterministic, 1 = creative). Default: 0 for structured tasks. */
  temperature?: number;
}

/**
 * The AI Provider contract.
 * Every AI model integration implements this single interface.
 */
export interface AIProvider {
  /** Human-readable name for logging (e.g., "openai-gpt-4o-mini") */
  readonly name: string;

  /**
   * Send a conversation to the AI model and get a text response.
   * Throws on network/API errors — the caller handles fallback.
   */
  complete(messages: AIMessage[], options?: AIRequestOptions): Promise<string>;
}

/**
 * Null provider — used when no AI key is configured.
 * Always throws, forcing callers to use their declared fallback.
 * This ensures the application works without AI (graceful degradation).
 */
export class NullAIProvider implements AIProvider {
  readonly name = "null";

  async complete(): Promise<string> {
    throw new Error(
      "AI is not configured. Set OPENAI_API_KEY to enable AI capabilities."
    );
  }
}
