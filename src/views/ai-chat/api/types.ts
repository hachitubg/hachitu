export interface FreeAiModel {
  id: string
  name: string
  description: string | null
  contextLength: number | null
  supports: string[]
  inputModalities: string[]
  outputModalities: string[]
}

export interface FreeAiModelsResponse {
  provider: string
  router: string
  models: FreeAiModel[]
}

export type AiChatRole = 'user' | 'assistant'

export interface AiChatBubble {
  id: string
  role: AiChatRole
  content: string
  modelLabel?: string
}

export interface AiChatRequestMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiChatCompletionChoice {
  message?: {
    role?: string
    content?: string | null
  }
}

export interface AiChatCompletionResponse {
  model?: string
  provider?: string
  choices?: AiChatCompletionChoice[]
}

export interface AiGatewayErrorPayload {
  error?: {
    message?: string
    code?: number
    metadata?: Record<string, unknown>
  }
  user_id?: string
}
