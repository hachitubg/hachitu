# HACHITU Blueprint

Tài liệu này chốt hướng tách `vibe.j2team.org` thành dự án cá nhân `HACHITU` nhưng vẫn giữ lại phần mạnh nhất của source gốc: launcher nhiều mini-app, frontend hiện đại và cách tổ chức repo rõ ràng.

## Mục tiêu

- giữ stack frontend hiện tại: Vue 3.5, TypeScript strict, Vite 7, Tailwind CSS v4, Vue Router 5, Pinia 3, Unhead, VueUse, Iconify
- giữ mô hình `launcher + sub-apps`
- đổi định danh dự án sang `HACHITU`
- ưu tiên backend đơn giản, dễ debug, dễ deploy trên VPS

## Định hướng backend hiện tại

`HACHITU` không đi theo hướng realtime phân tán phức tạp mặc định nữa.

Kiến trúc ưu tiên:

- realtime: `Node.js + Socket.IO`
- state room: giữ trong memory
- database: không dùng mặc định
- cleanup room: theo TTL

Chỉ thêm database khi thực sự cần:

- tài khoản
- leaderboard
- lịch sử dài hạn
- analytics
- khôi phục state sau restart

## Kiến trúc nên giữ nguyên

Các phần frontend sau là lõi tốt của repo gốc và nên giữ:

- `src/main.ts`
- `src/router/index.ts`
- `src/assets/main.css`
- `src/types/page.ts`
- `src/data/pages-loader.ts`
- `src/stores/usePagesStore.ts`
- `src/stores/useFavoritesStore.ts`
- `src/stores/useRecentlyViewedStore.ts`
- `scripts/generate-pages-json.mjs`
- `scripts/create-page.mjs`
- `scripts/generate-og-pages.mjs`
- `scripts/generate-sitemap.mjs`
- `vite.config.ts`

## Cấu trúc repo khuyến nghị

```text
hachitu/
  docs/
  public/
  scripts/
  server/
    index.mjs
    routes/
    apps/
    realtime/
  src/
    assets/
    components/
    composables/
    data/
    router/
    stores/
    types/
    views/
  package.json
  vite.config.ts
```

## Frontend ownership

Mỗi mini-app nên giữ frontend client của nó trong:

```text
src/views/<app>/
  index.vue
  meta.ts
  api/
    client.ts
    ws.ts
    types.ts
```

## Backend ownership

Nếu app cần API hoặc realtime:

```text
server/
  routes/
    apps/
      <app>.ts
  apps/
    <app>/
      service.ts
      handlers.ts
      types.ts
```

## Hướng mở rộng multiplayer

Nếu muốn làm chat hoặc game online giữa bạn bè:

- room theo link
- nickname tạm
- Socket.IO
- room state trong `Map`
- cleanup theo TTL

Xem thêm:

- `docs/HACHITU_MULTIPLAYER_ARCHITECTURE.md`

## Hướng mở rộng API cho từng app

Nếu app cần API riêng:

- frontend client ở `src/views/<app>/api/`
- backend logic ở `server/apps/<app>/`

Xem thêm:

- `docs/HACHITU_APP_API_GUIDELINES.md`

## Hướng mở rộng AI

Nếu nhiều app cần AI:

- frontend không giữ secret
- backend nội bộ gọi OpenRouter
- frontend chỉ gọi endpoint nội bộ như `/api/ai/chat`

Xem thêm:

- `docs/HACHITU_AI_API_GUIDELINES.md`

## Kế hoạch migrate thực dụng

### Bước 1

- rebrand metadata
- dọn homepage theo ngữ cảnh cá nhân
- giữ launcher và routing

### Bước 2

- thêm `server/` khi app bắt đầu cần realtime hoặc API riêng
- dùng `Node.js + Socket.IO` cho app realtime
- không thêm database vội

### Bước 3

- chỉ thêm persistence khi thật sự cần

## Kết luận

`HACHITU` nên ưu tiên:

1. frontend launcher sạch và dễ mở rộng
2. backend VPS đơn giản
3. realtime nhẹ bằng Socket.IO
4. không database nếu chưa cần
