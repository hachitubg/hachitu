# HACHITU

Starter repo cho mô hình `launcher + nhiều mini-app` cá nhân, lấy cảm hứng từ kiến trúc của `vibe.j2team.org` nhưng đã được rút gọn để phù hợp với một dự án riêng.

## Có sẵn gì

- Vue 3.5 + TypeScript strict
- Vite 7 + Tailwind CSS v4
- Vue Router 5 + Pinia 3
- auto-routing từ `src/views/<slug>/meta.ts`
- build pipeline tạo `pages.json`, OG pages và sitemap
- homepage launcher sáng màu
- bookmarks + recently viewed

## Hướng kiến trúc hiện tại

`HACHITU` ưu tiên mô hình đơn giản:

- frontend SPA ở `src/`
- mini-app nằm trong `src/views/<app>/`
- realtime dùng `Node.js + Socket.IO`
- room state giữ trong memory
- mặc định không dùng database nếu app chỉ cần tương tác realtime

Điều này phù hợp với:

- chat room cho bạn bè
- mini game nhiều người chơi
- tool cộng tác realtime nhẹ

## Vì sao không dùng database mặc định

Nếu mục tiêu chỉ là:

- tạo room nhanh
- chơi hoặc chat realtime
- room tự mất khi server restart hoặc quá lâu không dùng

thì database chỉ làm hệ thống nặng thêm.

Hướng khuyến nghị cho `HACHITU` là:

- room state trong RAM
- TTL cleanup theo `lastActiveAt`
- chỉ thêm database khi thực sự cần leaderboard, tài khoản, lịch sử dài hạn

## Backend và AI

Với app cần AI:

- frontend không gọi secret trực tiếp
- nên có một API gateway nhỏ ở backend nội bộ
- backend giữ `OPENROUTER_API_KEY`
- frontend gọi endpoint nội bộ như `/api/ai/chat`

Với app cần realtime:

- dùng `Socket.IO` trên VPS
- không cần hạ tầng realtime phân tán nếu chưa cần persistence

## Chạy local

```sh
pnpm install
pnpm dev
```

`pnpm dev` hiện chạy:

- `vite`
- `node server/index.mjs`

Nếu bạn còn cần chế độ mở rộng cũ cho một vài route tạm thời:

```sh
pnpm dev:full
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

Hướng deploy khuyến nghị:

- frontend build ra `dist/`
- `nginx` serve static files trên VPS
- nếu cần realtime thì chạy thêm một tiến trình `Node.js + Socket.IO`
- nếu cần AI thì backend nội bộ giữ secret và expose API

Xem chi tiết tại:

- `docs/HACHITU_DEPLOYMENT.md`
- `deploy/nginx/hachitu.conf.example`
