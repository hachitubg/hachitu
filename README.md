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
- TTL cleanup theo từng room thay vì xóa sạch database

Xem chi tiết tại:

- `docs/HACHITU_MULTIPLAYER_ARCHITECTURE.md`
- `docs/HACHITU_APP_API_GUIDELINES.md`

## Chạy local

```sh
pnpm install
pnpm dev
```

## Chạy phần multiplayer scaffold

Frontend hiện vẫn chạy bằng:

```sh
pnpm dev:app
```

Worker multiplayer scaffold chạy bằng:

```sh
pnpm dev:worker
```

Phần Worker hiện đã có:

- API room cơ bản trong `worker/routes/rooms.ts`
- Durable Object room trong `worker/durable-objects/game-room.ts`
- protocol WebSocket trong `worker/multiplayer/protocol.ts`
- TTL cleanup trong `worker/multiplayer/ttl.ts`

Đây là khung backend để bạn triển khai game thật, chưa phải gameplay hoàn chỉnh.

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
- `docs/HACHITU_DEPLOYMENT.md`

## Deploy

Repo này đã được chuẩn bị sẵn phần khung cho:

- GitHub CI
- VPS frontend qua `nginx`
- reverse proxy `/api/*` về backend Worker

Xem chi tiết tại:

- `docs/HACHITU_DEPLOYMENT.md`
- `deploy/nginx/hachitu.conf.example`
