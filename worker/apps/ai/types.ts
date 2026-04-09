export type AiChatRole = 'system' | 'user' | 'assistant'

export interface AiChatMessage {
  role: AiChatRole
  content: string
}

export interface AiChatRequestInput {
  messages?: AiChatMessage[]
  systemPrompt?: string
  model?: string
  models?: string[]
  temperature?: number
  maxTokens?: number
}

export interface NormalizedAiChatRequest {
  messages: AiChatMessage[]
  systemPrompt: string | null
  model: string
  models: string[]
  temperature: number | null
  maxTokens: number | null
}

export interface OpenRouterModelPricing {
  prompt?: string
  completion?: string
  request?: string
  image?: string
  web_search?: string
  internal_reasoning?: string
  input_cache_read?: string
  input_cache_write?: string
}

export interface OpenRouterModelArchitecture {
  input_modalities?: string[]
  output_modalities?: string[]
}

export interface OpenRouterModel {
  id: string
  name: string
  description?: string
  context_length?: number
  pricing?: OpenRouterModelPricing
  architecture?: OpenRouterModelArchitecture
  supported_parameters?: string[]
}

export interface FreeAiModelSummary {
  id: string
  name: string
  description: string | null
  contextLength: number | null
  supports: string[]
  inputModalities: string[]
  outputModalities: string[]
}
