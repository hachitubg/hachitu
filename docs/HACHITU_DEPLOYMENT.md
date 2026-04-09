# HACHITU Deployment

Tài liệu này chuẩn bị sẵn cho 2 việc:

- đưa source code lên Git
- deploy frontend lên VPS

## Kết luận ngắn

`HACHITU` hiện không phải một app Node backend thuần để bê nguyên lên VPS rồi chạy hết mọi thứ.

Kiến trúc hiện tại là:

- frontend SPA build ra `dist/`
- backend realtime ở `worker/`
- chat realtime đang dùng `Cloudflare Worker + Durable Objects + WebSocket`

Vì vậy, phương án thực tế và ít rủi ro nhất là:

1. frontend static chạy trên VPS qua `nginx`
2. backend realtime tiếp tục chạy trên Cloudflare
3. VPS reverse proxy `/api/*` về Worker domain hoặc custom domain của Worker

Cách này giữ nguyên tính năng `chat-online` mà không cần rewrite backend.

## Những gì đã được chuẩn bị trong repo

- GitHub CI: [ci.yml](/D:/Project/vibe.j2team.org/HACHITU/.github/workflows/ci.yml)
- mẫu cấu hình nginx: [hachitu.conf.example](/D:/Project/vibe.j2team.org/HACHITU/deploy/nginx/hachitu.conf.example)
- `.gitignore` đã bỏ qua `.wrangler/` và log local

## Luồng deploy khuyến nghị

### 1. Git

- tạo repo GitHub mới cho `HACHITU`
- push toàn bộ thư mục `HACHITU` như một repo riêng
- bật GitHub Actions

CI hiện sẽ tự chạy khi:

- push lên `main`
- push lên `develop`
- push lên `feature/**`
- mở Pull Request vào `main`

CI sẽ chạy:

- `pnpm install --frozen-lockfile`
- `pnpm lint:ci`
- `pnpm build`

### 2. Cloudflare backend

Giữ Worker backend cho:

- `/api/chat/*`
- `/api/apps/chat-online/*`
- WebSocket room của chat
- Durable Objects / room state

Frontend hiện đang gọi API theo same-origin:

- `/api/chat/rooms`
- `/api/apps/chat-online/discoveries`

Và WebSocket URL cũng được build từ origin hiện tại ở frontend. Do đó khi lên VPS, `nginx` phải proxy `/api/*` về backend Worker để giao diện không phải sửa code.

### 3. VPS frontend

Trên VPS chỉ cần:

- clone hoặc pull repo
- `pnpm install --frozen-lockfile`
- `pnpm build`
- dùng `nginx` serve thư mục `dist/`

Config mẫu đã có tại:

- [hachitu.conf.example](/D:/Project/vibe.j2team.org/HACHITU/deploy/nginx/hachitu.conf.example)

## Điều chưa nên làm lúc này

Không nên cố deploy toàn bộ `worker/` lên VPS như một app Node bình thường, vì:

- Durable Objects là runtime đặc thù của Cloudflare
- WebSocket flow hiện đang phụ thuộc Worker route hiện tại
- muốn chạy full trên VPS sẽ phải viết lại backend realtime

Nếu sau này bạn muốn bỏ Cloudflare hoàn toàn, ta nên tách bước đó thành một task riêng:

- rewrite `worker/` sang `Node + Fastify/Hono + WebSocket`
- thay Durable Objects bằng `SQLite/Postgres/Redis`

## Thông tin tôi sẽ cần khi bạn sẵn sàng gửi VPS

- IP hoặc domain VPS
- hệ điều hành VPS
- user SSH
- SSH port
- đường dẫn deploy mong muốn, ví dụ `/var/www/hachitu`
- bạn muốn frontend domain là gì, ví dụ `hachitu.example.com`
- backend Worker sẽ dùng domain nào
- bạn muốn SSL bằng `certbot`, `Cloudflare proxy`, hay đã có sẵn

## Checklist trước khi deploy thật

- đổi [constants.ts](/D:/Project/vibe.j2team.org/HACHITU/src/data/constants.ts) sang repo URL thật
- xác nhận domain production thật trong metadata nếu bạn muốn tôi sửa tiếp
- tạo repo GitHub thật cho `HACHITU`
- tạo Worker production domain hoặc custom domain cho backend
- chuẩn bị SSH access cho VPS

## Khi bạn gửi VPS info

Tôi có thể làm tiếp ngay các phần sau:

1. chỉnh sẵn `nginx` config theo domain/IP thật
2. chuẩn bị lệnh deploy cụ thể cho Ubuntu/Debian
3. thêm script `pull + build + reload nginx`
4. nếu cần, thêm GitHub Actions deploy tự động lên VPS qua SSH
