import type {
  AiChatMessage,
  AiChatRequestInput,
  NormalizedAiChatRequest,
} from './types'

const DEFAULT_MODEL = 'openrouter/free'

function isValidRole(value: string): value is AiChatMessage['role'] {
  return value === 'system' || value === 'user' || value === 'assistant'
}

function normalizeMessageList(value: AiChatRequestInput['messages']): AiChatMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const role = typeof item.role === 'string' ? item.role : ''
    const content = typeof item.content === 'string' ? item.content.trim() : ''
    if (!isValidRole(role) || !content) {
      return []
    }

    return [{ role, content }]
  })
}

function normalizeModelId(value: string): string {
  const model = value.trim()
  if (!model) {
    return DEFAULT_MODEL
  }

  if (model === 'openrouter/free' || model.endsWith(':free')) {
    return model
  }

  return `${model}:free`
}

function normalizeModels(value: AiChatRequestInput['models']): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(normalizeModelId)
    .filter((item, index, items) => items.indexOf(item) === index)
}

function normalizeOptionalNumber(
  value: number | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return Math.min(Math.max(value, min), max)
}

export function normalizeAiChatRequest(
  input: AiChatRequestInput,
): NormalizedAiChatRequest {
  const messages = normalizeMessageList(input.messages)
  if (messages.length === 0) {
    throw new Error('messages phải là mảng và cần ít nhất 1 message hợp lệ')
  }

  const systemPrompt =
    typeof input.systemPrompt === 'string' && input.systemPrompt.trim()
      ? input.systemPrompt.trim()
      : null

  return {
    messages,
    systemPrompt,
    model: normalizeModelId(typeof input.model === 'string' ? input.model : ''),
    models: normalizeModels(input.models),
    temperature: normalizeOptionalNumber(input.temperature, 0, 2),
    maxTokens: normalizeOptionalNumber(input.maxTokens, 1, 8192),
  }
}
