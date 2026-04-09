# HACHITU AI API Guidelines

Tài liệu này mô tả cách tích hợp AI vào `HACHITU` theo hướng đơn giản và dễ dùng lại cho nhiều mini-app.

## Kết luận ngắn

Khuyến nghị:

- frontend không gọi secret trực tiếp
- backend nội bộ giữ `OPENROUTER_API_KEY`
- frontend gọi endpoint nội bộ như `/api/ai/chat`

## Cấu trúc khuyến nghị

```text
src/views/<app>/
  api/
    client.ts
    types.ts

server/
  routes/
    ai.ts
  apps/
    ai/
      service.ts
      providers.ts
      types.ts
```

## Vì sao không gọi OpenRouter trực tiếp từ frontend

- lộ API key
- khó đổi provider
- khó thêm fallback
- khó rate-limit

## Hướng dùng chung cho nhiều app

- `server/routes/ai.ts` nhận request nội bộ
- `server/apps/ai/service.ts` gọi provider thật
- từng app frontend chỉ gọi API nội bộ

## Endpoint gợi ý

- `GET /api/ai/models/free`
- `POST /api/ai/chat`

## Rule thực dụng

- secret chỉ nằm ở backend
- frontend không biết key
- nếu nhiều app cùng dùng AI, dùng chung một gateway
- nếu cần đổi provider, chỉ sửa backend

## Khi nào mới cần persistence

Không cần database nếu:

- chỉ chat trong phiên
- không lưu lịch sử dài hạn
- không cần account

Chỉ thêm database nếu bạn muốn:

- lưu conversation history
- lưu persona hoặc user profile
- lưu usage analytics
