# HACHITU

Starter repo cho mô hình `launcher + nhiều mini-app` cá nhân, lấy cảm hứng từ kiến trúc của `vibe.j2team.org` nhưng đã được rút gọn để phù hợp với một dự án riêng.

## Có sẵn gì

- Vue 3.5 + TypeScript strict
- Vite 7 + Tailwind CSS v4
- Vue Router 5 + Pinia 3
- Auto-routing từ `src/views/<slug>/meta.ts`
- Build pipeline tạo `pages.json`, OG pages và sitemap
- Homepage launcher sáng màu
- Bookmarks + recently viewed
- Sample page `hello-world`

## Hướng mở rộng multiplayer

Starter này đã có tài liệu kiến trúc cho game online giữa bạn bè theo hướng:

- Cloudflare Durable Objects
- WebSocket cho realtime room
- SQLite-backed room storage
- TTL cleanup theo từng room

Xem chi tiết tại:

- `docs/HACHITU_MULTIPLAYER_ARCHITECTURE.md`
- `docs/HACHITU_APP_API_GUIDELINES.md`

## Hướng mở rộng AI API

Repo đã có sẵn AI gateway qua Worker để các mini-app dùng chung một secret OpenRouter và chỉ gọi free models nếu muốn.

Các endpoint hiện có:

- `GET /api/ai/models/free`
- `POST /api/ai/chat`

Xem chi tiết tại:

- `docs/HACHITU_AI_API_GUIDELINES.md`

## Chạy local

```sh
pnpm install
pnpm dev
```

## Chạy phần Worker

Frontend hiện vẫn chạy bằng:

```sh
pnpm dev:app
```

Worker chạy bằng:

```sh
pnpm dev:worker
```

## Cấu hình AI local

Tạo file `.dev.vars` cạnh `wrangler.json`:

```dotenv
OPENROUTER_API_KEY="sk-or-v1-your-key"
OPENROUTER_SITE_URL="http://127.0.0.1:8787"
OPENROUTER_SITE_NAME="HACHITU Local"
```

## Việc nên làm đầu tiên

1. Đổi `REPO_URL` trong `src/data/constants.ts`
2. Đổi `SITE_URL` và metadata mặc định trong `src/App.vue`, `src/router/index.ts`
3. Sửa nội dung hero ở `src/components/home/HeroSection.vue`
4. Tạo app đầu tiên bằng:

```sh
pnpm create:page my-first-app
```

## Tài liệu

- `docs/HACHITU_BLUEPRINT.md`
- `docs/HACHITU_LIGHT_DESIGN_SYSTEM.md`
- `docs/HACHITU_MULTIPLAYER_ARCHITECTURE.md`
- `docs/HACHITU_APP_API_GUIDELINES.md`
- `docs/HACHITU_AI_API_GUIDELINES.md`
- `docs/HACHITU_DEPLOYMENT.md`

## Deploy

Repo này đã được chuẩn bị sẵn phần khung cho:

- GitHub CI
- VPS frontend qua `nginx`
- reverse proxy `/api/*` về backend Worker

Xem chi tiết tại:

- `docs/HACHITU_DEPLOYMENT.md`
- `deploy/nginx/hachitu.conf.example`
