/**
 * AI Module — public API
 *
 * Exports the AIProvider interface, all concrete provider implementations,
 * the gateway functions that bridge AI capabilities to the Action Bus,
 * and the command interpreter for natural language → action dispatch.
 */
export type { AIProvider, AIMessage, AIRequestOptions } from "./provider.js";
export { NullAIProvider } from "./provider.js";
export { OpenAIProvider } from "./openai-provider.js";
export { GeminiProvider } from "./gemini-provider.js";
export { AnthropicProvider } from "./anthropic-provider.js";
export {
  initAIGateway,
  getAIProvider,
  setAIProvider,
  registerAICapability,
  wireAITrigger,
  registerEntityAICapabilities,
} from "./gateway.js";
export { interpretCommand, type CommandResult, type ChatMessage } from "./command.js";
export {
  generateEntities,
  entityToTypeScript,
  writeEntitiesToDisk,
  type GeneratedEntity,
  type GenerationResult,
  type WriteResult,
} from "./entity-generator.js";
export {
  installEntity,
  installEntities,
  type InstallResult,
} from "./entity-installer.js";
export {
  createSession,
  getSession,
  listSessions,
  updateSessionTitle,
  deleteSession,
  createMessage,
  listMessages,
  type ChatSession,
  type ChatMessageRecord,
} from "./chat-store.js";
