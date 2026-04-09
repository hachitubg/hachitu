# HACHITU Deployment

Tài liệu này chốt hướng deploy khuyến nghị cho `HACHITU`.

## Kết luận ngắn

`HACHITU` nên deploy theo hướng:

- frontend build ra `dist/`
- `nginx` serve static files
- nếu cần realtime thì chạy thêm một process `Node.js + Socket.IO`
- nếu cần AI thì backend nội bộ giữ secret và expose `/api/ai/*`

## Kiến trúc deploy khuyến nghị

```text
Browser
  -> https://hachitu.io.vn

Nginx
  -> serve dist/
  -> proxy /api/* -> Node backend
  -> proxy /socket.io/* -> Node backend

Node.js
  -> API nội bộ
  -> Socket.IO realtime
  -> room state trong memory
```

## Vì sao hướng này phù hợp

- dễ deploy trên VPS
- không phụ thuộc runtime phức tạp
- dễ debug
- hợp với project cá nhân
- không cần database nếu app chỉ cần realtime room

## Những gì nên có trên VPS

- `nginx`
- `node`
- `pnpm`
- `pm2` hoặc `systemd`
- `certbot` nếu làm SSL trực tiếp trên VPS

## Cấu trúc thư mục gợi ý

```text
/var/www/hachitu/
  dist/
  server/
  package.json
```

## Chạy local

### Frontend + realtime server

```sh
pnpm install
pnpm dev
```

`pnpm dev` hiện chạy:

- `vite`
- `node server/index.mjs`

### Chế độ tương thích đầy đủ

```sh
pnpm dev:full
```

Chỉ dùng khi bạn còn cần chế độ mở rộng cũ cho vài route đặc biệt trong lúc chuyển đổi.

## Luồng deploy

### 1. Build frontend

```sh
pnpm install
pnpm build
```

Sau đó upload `dist/` lên VPS và để `nginx` serve.

### 2. Chạy backend realtime/API

Nếu đã có `server/`:

```sh
node server/index.mjs
```

Nên chạy bằng:

- `pm2`
- hoặc `systemd`

### 3. Nginx

Frontend:

- `root /var/www/hachitu/dist`
- `try_files $uri $uri/ /index.html`

Backend:

- proxy `/api/*`
- proxy `/socket.io/*`

## Khi nào mới thêm database

Chỉ thêm database khi cần:

- tài khoản
- leaderboard
- lịch sử dài hạn
- analytics
- phục hồi room sau restart

Nếu chưa cần các thứ đó, giữ backend ở mức:

- room state trong memory
- cleanup theo `lastActiveAt`

## SSL

Nếu domain trỏ trực tiếp về VPS:

```sh
certbot --nginx -d hachitu.io.vn -d www.hachitu.io.vn
```

## Checklist deploy

- domain trỏ đúng về VPS
- `nginx -t` pass
- frontend `dist/` đã được upload
- backend process đang chạy nếu app cần realtime hoặc API
- HTTPS trả về `200`
