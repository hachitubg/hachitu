import type { AiChatRequestInput } from '../../apps/ai/types'
import { fetchOpenRouterFreeModels, requestOpenRouterChat } from '../../apps/ai/service'
import { normalizeAiChatRequest } from '../../apps/ai/validators'
import { json, text } from '../../multiplayer/http'

export interface AiGatewayEnv {
  OPENROUTER_API_KEY?: string
  OPENROUTER_SITE_URL?: string
  OPENROUTER_SITE_NAME?: string
}

function hasOpenRouterKey(
  env: AiGatewayEnv,
): env is AiGatewayEnv & { OPENROUTER_API_KEY: string } {
  return typeof env.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.trim().length > 0
}

export async function routeAiGatewayRequest(
  request: Request,
  env: AiGatewayEnv,
): Promise<Response | null> {
  const url = new URL(request.url)

  if (url.pathname === '/api/ai/models/free' && request.method === 'GET') {
    const models = await fetchOpenRouterFreeModels()

    return json({
      provider: 'openrouter',
      router: 'openrouter/free',
      models,
    })
  }

  if (url.pathname !== '/api/ai/chat') {
    return null
  }

  if (request.method !== 'POST') {
    return text('Method Not Allowed', { status: 405 })
  }

  if (!hasOpenRouterKey(env)) {
    return json(
      {
        error: 'Thiếu OPENROUTER_API_KEY. Hãy tạo .dev.vars hoặc thêm secret vào Worker.',
      },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as AiChatRequestInput

  try {
    const input = normalizeAiChatRequest(body)
    const response = await requestOpenRouterChat(
      input,
      env.OPENROUTER_API_KEY,
      env.OPENROUTER_SITE_URL,
      env.OPENROUTER_SITE_NAME,
    )
    const payload = await response.json()

    return json(payload, { status: response.status })
  }
  catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Không thể xử lý request tới OpenRouter',
      },
      { status: 400 },
    )
  }
}
