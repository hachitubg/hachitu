# HACHITU AI API Guidelines

Tài liệu này chốt cách tích hợp AI vào `HACHITU` theo hướng dùng chung một cổng backend, tránh lộ API key ở frontend và giữ cho các mini-app gọi AI theo cùng một chuẩn.

## Mục tiêu

- Một `OPENROUTER_API_KEY` dùng cho nhiều model
- Chỉ dùng free models khi cần tiết kiệm chi phí
- Có thể tự fallback sang model free khác
- Frontend của từng app không cầm secret

## Quy tắc kiến trúc

Không gọi OpenRouter trực tiếp từ `src/views/<app>/`.

Thay vào đó:

- frontend app gọi `GET /api/ai/models/free` hoặc `POST /api/ai/chat`
- `worker/` giữ `OPENROUTER_API_KEY`
- worker mới là nơi gọi `https://openrouter.ai/api/v1/...`

Cấu trúc đã có sẵn:

```text
worker/
  routes/
    apps/
      ai.ts
  apps/
    ai/
      service.ts
      types.ts
      validators.ts
```

## Vì sao dùng OpenRouter cho HACHITU

Theo docs chính thức của OpenRouter:

- một API key có thể gọi nhiều model khác nhau qua cùng một API
- API dùng Bearer token
- có `openrouter/free` để router tự chọn free model
- có `models` fallback list để thử model khác theo thứ tự ưu tiên

Nguồn:

- Authentication: https://openrouter.ai/docs/api/reference/authentication
- Models overview: https://openrouter.ai/docs/guides/overview/models
- Free models router: https://openrouter.ai/docs/guides/routing/routers/free-models-router
- Model fallbacks: https://openrouter.ai/docs/guides/routing/model-fallbacks
- FAQ: https://openrouter.ai/docs/faq

## Endpoint nội bộ đã có sẵn

### 1. Lấy danh sách free models

```http
GET /api/ai/models/free
```

Response trả về danh sách model free đã được worker lọc từ OpenRouter Models API.

### 2. Chat completion dùng chung

```http
POST /api/ai/chat
content-type: application/json
```

Body mẫu:

```json
{
  "systemPrompt": "Bạn là trợ lý ngắn gọn, trả lời bằng tiếng Việt.",
  "model": "openrouter/free",
  "models": [
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free"
  ],
  "messages": [
    {
      "role": "user",
      "content": "Tóm tắt ý tưởng app chat realtime này."
    }
  ],
  "temperature": 0.7,
  "maxTokens": 600
}
```

Gợi ý dùng thực tế:

- đơn giản nhất: chỉ truyền `"model": "openrouter/free"`
- nếu muốn fallback rõ ràng: truyền thêm `models`
- route hiện tại sẽ ép `model/models` sang free variant nếu thiếu `:free`

## Cách fallback đúng

### Cách 1: Dễ nhất

```json
{
  "model": "openrouter/free"
}
```

### Cách 2: Có kiểm soát

```json
{
  "model": "openrouter/free",
  "models": [
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "google/gemma-3-27b-it:free"
  ]
}
```

Lưu ý:

- free model availability thay đổi theo thời điểm
- không nên hard-code một danh sách dài rồi quên cập nhật
- nếu app không cần model picker, `openrouter/free` vẫn là lựa chọn gọn nhất

## Cách frontend app nên gọi

Ví dụ trong app:

```text
src/views/my-ai-app/
  api/
    client.ts
    types.ts
```

`client.ts` có thể giữ rất mỏng:

```ts
export async function chatWithAi(input: {
  systemPrompt?: string
  model?: string
  models?: string[]
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}) {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('AI request failed')
  }

  return response.json()
}
```

## Local development

Cloudflare Workers docs hiện hướng dẫn đặt secret local trong `.dev.vars` hoặc `.env` cùng thư mục với `wrangler.json`.

Nguồn:

- https://developers.cloudflare.com/workers/development-testing/environment-variables/

Trong `HACHITU`, tạo file:

```text
.dev.vars
```

Nội dung:

```dotenv
OPENROUTER_API_KEY="sk-or-v1-your-key"
OPENROUTER_SITE_URL="http://127.0.0.1:8787"
OPENROUTER_SITE_NAME="HACHITU Local"
```

Sau đó chạy:

```sh
pnpm dev:worker
```

Test nhanh:

```sh
curl -X POST http://127.0.0.1:8787/api/ai/chat ^
  -H "content-type: application/json" ^
  -d "{\"model\":\"openrouter/free\",\"messages\":[{\"role\":\"user\",\"content\":\"Xin chào, hãy giới thiệu HACHITU trong 2 câu.\"}]}"
```

## Deploy production

Khi deploy Worker:

- không commit `.dev.vars`
- thêm `OPENROUTER_API_KEY` dưới dạng Worker secret
- có thể thêm `OPENROUTER_SITE_URL` và `OPENROUTER_SITE_NAME` để attribution rõ ràng hơn

## Rate-limit và kỳ vọng thực tế

Theo FAQ hiện tại của OpenRouter:

- free models thường có rate limit thấp
- nếu chưa mua credits, free model API requests bị giới hạn 50 request/ngày
- nếu đã mua ít nhất 10 credits, giới hạn free models là 1000 request/ngày

Vì vậy:

- phù hợp để test local, prototype, mini-tools
- chưa phù hợp để coi là tầng AI production miễn phí vô hạn

## Rule cho các app tương lai

- secret chỉ nằm trong `worker/`
- frontend chỉ gọi API nội bộ của `HACHITU`
- ưu tiên `openrouter/free` nếu mục tiêu là free-first
- chỉ thêm fallback list khi app thật sự cần kiểm soát model
- nếu một app cần AI nhiều bước, hãy tạo route riêng của app trong `worker/routes/apps/<app>.ts`, nhưng vẫn gọi qua `worker/apps/ai/service.ts` hoặc cùng pattern
