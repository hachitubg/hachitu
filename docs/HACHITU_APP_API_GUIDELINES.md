# HACHITU App API Guidelines

Tài liệu này mô tả cách thiết kế API cho từng mini-app trong `HACHITU` để repo vẫn gọn, dễ mở rộng và không biến thành một file `api.ts` khổng lồ dùng chung cho mọi thứ.

## Nguyên tắc chốt

- frontend client của app nằm gần app đó
- backend route của app nằm ở `server/`
- realtime dùng shared layer `Socket.IO`
- không mặc định dùng database

Nói ngắn gọn:

- `src/views/<app>/api/` = code gọi API từ frontend
- `server/apps/<app>/` = backend logic của app

## Khi nào chỉ cần frontend client local

Nếu app chỉ gọi public API và không có secret:

```text
src/views/my-app/
  index.vue
  meta.ts
  api/
    client.ts
    types.ts
```

Phù hợp khi:

- không có API key
- CORS ổn
- không cần backend trung gian

## Khi nào nên đi qua backend `server/`

Nên đi qua backend khi:

- cần giữ secret
- muốn chuẩn hóa dữ liệu
- muốn gom nhiều provider thành một endpoint nội bộ
- muốn thêm rate-limit hoặc cache

Cấu trúc khuyến nghị:

```text
src/views/my-app/
  api/
    client.ts
    types.ts

server/
  routes/
    apps/
      my-app.ts
  apps/
    my-app/
      service.ts
      handlers.ts
      types.ts
```

## Khi nào dùng realtime

Nên dùng `Socket.IO` nếu app cần:

- room
- presence
- đồng bộ state
- typing
- game theo lượt
- chat realtime

Không nên dùng realtime nếu chỉ:

- submit form
- đọc dữ liệu một lần
- polling chậm là đủ

## Realtime nên tổ chức thế nào

Không nên rải `new WebSocket(...)` hoặc `io(...)` ở nhiều component.

Tốt hơn:

```text
src/views/<app>/
  api/
    client.ts
    ws.ts
    types.ts

server/
  realtime/
    socket.ts
    protocol.ts
    room-registry.ts
```

Trong đó:

- `client.ts`: HTTP của app
- `ws.ts`: kết nối Socket.IO phía frontend
- `room-registry.ts`: giữ state room trong memory
- `protocol.ts`: thống nhất event names

## Cấu trúc backend khuyến nghị

```text
server/
  index.mjs
  routes/
    ai.ts
    apps/
      <app>.ts
  realtime/
    socket.ts
    protocol.ts
    room-registry.ts
    cleanup.ts
  apps/
    <app>/
      service.ts
      handlers.ts
      types.ts
      game-logic.ts
```

## Rule thực dụng

### 1. Không tạo `src/api/global-client.ts`

App nào có API thì tự có `api/client.ts` của app đó.

### 2. Không nhét backend vào `src/views/`

`src/views/` là frontend boundary. Backend đi vào `server/`.

### 3. Chỉ tách shared khi thực sự shared

Nếu mới có 1 app dùng, cứ giữ code ở app đó.

Chỉ đẩy lên shared layer khi:

- đã có từ 3 app dùng chung
- hoặc nó là hạ tầng nền như AI gateway, auth, realtime transport

### 4. DTO phải nhỏ và rõ

Nên dùng:

- `CreateRoomRequest`
- `CreateRoomResponse`
- `JoinRoomRequest`
- `JoinRoomResponse`

Không trả nguyên state nội bộ nếu frontend không cần.

## AI gateway dùng chung

Nếu app cần AI:

- frontend gọi endpoint nội bộ như `/api/ai/chat`
- backend giữ secret OpenRouter
- nhiều app có thể dùng chung một AI gateway nhỏ trong `server/routes/ai.ts`

Xem thêm:

- `docs/HACHITU_AI_API_GUIDELINES.md`
