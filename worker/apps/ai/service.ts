import type {
  AiChatMessage,
  FreeAiModelSummary,
  NormalizedAiChatRequest,
  OpenRouterModel,
} from './types'

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_REFERER = 'http://127.0.0.1:8787'
const DEFAULT_TITLE = 'HACHITU'

function createOpenRouterHeaders(
  apiKey: string,
  siteUrl: string | undefined,
  siteName: string | undefined,
): HeadersInit {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    'http-referer': siteUrl?.trim() || DEFAULT_REFERER,
    'x-openrouter-title': siteName?.trim() || DEFAULT_TITLE,
  }
}

function isZeroPrice(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() === '0'
}

function isFreeModel(model: OpenRouterModel): boolean {
  const pricing = model.pricing
  if (!pricing) {
    return false
  }

  const values = Object.values(pricing)
  return values.length > 0 && values.every((value) => isZeroPrice(value))
}

function toFreeModelSummary(model: OpenRouterModel): FreeAiModelSummary {
  return {
    id: model.id,
    name: model.name,
    description: model.description?.trim() || null,
    contextLength: model.context_length ?? null,
    supports: model.supported_parameters ?? [],
    inputModalities: model.architecture?.input_modalities ?? [],
    outputModalities: model.architecture?.output_modalities ?? [],
  }
}

function buildMessages(input: NormalizedAiChatRequest): AiChatMessage[] {
  if (!input.systemPrompt) {
    return input.messages
  }

  return [{ role: 'system', content: input.systemPrompt }, ...input.messages]
}

function buildChatBody(input: NormalizedAiChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: buildMessages(input),
    stream: false,
  }

  if (input.models.length > 0) {
    body.models = input.models
  }

  if (input.temperature !== null) {
    body.temperature = input.temperature
  }

  if (input.maxTokens !== null) {
    body.max_tokens = input.maxTokens
  }

  return body
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

export async function fetchOpenRouterFreeModels(): Promise<FreeAiModelSummary[]> {
  const response = await fetch(`${OPENROUTER_API_BASE}/models`)
  if (!response.ok) {
    throw new Error(`Không lấy được danh sách model từ OpenRouter: ${response.status}`)
  }

  const payload = await readJson<{ data?: OpenRouterModel[] }>(response)
  const models = Array.isArray(payload.data) ? payload.data : []

  return models
    .filter(isFreeModel)
    .map(toFreeModelSummary)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function requestOpenRouterChat(
  input: NormalizedAiChatRequest,
  apiKey: string,
  siteUrl?: string,
  siteName?: string,
): Promise<Response> {
  return fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: createOpenRouterHeaders(apiKey, siteUrl, siteName),
    body: JSON.stringify(buildChatBody(input)),
  })
}
