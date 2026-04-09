import type {
  AiChatCompletionResponse,
  AiChatRequestMessage,
  AiGatewayErrorPayload,
  FreeAiModelsResponse,
} from './types'

async function readJsonOrThrow(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Backend AI chưa sẵn sàng. Hãy chạy Worker local bằng pnpm dev hoặc pnpm dev:worker.',
    )
  }

  return response.json()
}

export async function fetchFreeModels(): Promise<FreeAiModelsResponse> {
  let response: Response

  try {
    response = await fetch('/api/ai/models/free')
  }
  catch {
    throw new Error('Không kết nối được AI backend local. Hãy kiểm tra Worker đang chạy.')
  }

  const payload = (await readJsonOrThrow(response)) as FreeAiModelsResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || 'Không tải được danh sách model miễn phí')
  }

  return payload
}

export async function createAiChatCompletion(input: {
  model: string
  models?: string[]
  messages: AiChatRequestMessage[]
  systemPrompt?: string
  maxTokens?: number
  signal?: AbortSignal
}): Promise<AiChatCompletionResponse> {
  let response: Response

  try {
    response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    })
  }
  catch {
    throw new Error('Không kết nối được AI backend local. Hãy kiểm tra Worker đang chạy.')
  }

  const payload = (await readJsonOrThrow(response)) as
    | AiChatCompletionResponse
    | AiGatewayErrorPayload
    | { error?: string }

  if (!response.ok) {
    if ('error' in payload && typeof payload.error === 'object' && payload.error) {
      const message = payload.error.message?.trim() || 'Không gọi được AI chat'

      if (payload.error.code === 429) {
        throw new Error(
          `Free model đang bị giới hạn tạm thời hoặc tài khoản đã chạm quota miễn phí. ${message}`,
        )
      }

      throw new Error(message)
    }

    if ('error' in payload && typeof payload.error === 'string') {
      throw new Error(payload.error)
    }

    throw new Error('Không gọi được AI chat')
  }

  return payload as AiChatCompletionResponse
}
