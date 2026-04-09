# HACHITU App API Guidelines

Tài liệu này mô tả cách thiết kế API cho từng mini-app trong `HACHITU` để repo vẫn gọn, dễ mở rộng, và không biến thành một mớ `api.ts` dùng chung cho mọi thứ.

## Nguyên tắc chốt

**Không đặt tất cả API vào một file global.**

Thay vào đó:

- API nào chỉ phục vụ một app thì để ownership ở chính app đó
- Hạ tầng dùng chung cho nhiều app thì đặt ở shared worker layer
- Frontend client nên nằm gần `src/views/<app>/`
- Backend route và business logic không đặt trong `src/views/`

Nói ngắn gọn:

- `src/views/<app>/api/` = code gọi API từ frontend
- `worker/apps/<app>/` = code xử lý API của app ở backend

## Quy tắc quyết định

### Trường hợp 1: Chỉ gọi public API bên ngoài, không cần giấu secret

Ví dụ:

- trivia API
- dictionary API
- weather API public
- random quote API

Bạn có thể gọi trực tiếp từ app:

```text
src/views/my-app/
  index.vue
  meta.ts
  api/
    client.ts
    types.ts
```

Hướng này phù hợp khi:

- không có API key
- CORS hoạt động bình thường
- dữ liệu chỉ phục vụ đúng app đó
- không cần normalize phức tạp

### Trường hợp 2: Cần giấu API key hoặc chuẩn hóa dữ liệu

Ví dụ:

- gọi API bên thứ ba cần secret
- muốn đổi nhiều provider mà không sửa frontend
- muốn cache/rate-limit ở server
- muốn hợp nhất nhiều nguồn dữ liệu thành một response ổn định

Lúc này nên đi qua Worker:

```text
src/views/my-app/
  api/
    client.ts
    types.ts

worker/
  routes/
    apps/
      my-app.ts
  apps/
    my-app/
      service.ts
      schema.ts
      types.ts
```

Frontend chỉ biết gọi endpoint nội bộ như:

- `GET /api/apps/my-app/...`
- `POST /api/apps/my-app/...`

### Trường hợp 3: Game realtime hoặc collaborative app

Nếu app có:

- room
- lượt chơi
- presence
- sync trạng thái
- reconnect

thì không nên tự dựng một WebSocket stack mới trong từng app.

Thay vào đó:

- dùng shared realtime primitives trong `worker/multiplayer/`
- để game rules và state machine của app trong `worker/apps/<app>/`
- frontend app có `api/ws.ts` hoặc `api/realtime.ts` để quản lý kết nối

## Cấu trúc đề xuất

### Frontend app-local

```text
src/views/<app>/
  index.vue
  meta.ts
  components/
  composables/
  api/
    client.ts
    ws.ts
    types.ts
    mappers.ts
```

Giải thích:

- `client.ts`: HTTP calls của app
- `ws.ts`: kết nối WebSocket hoặc helper subscribe
- `types.ts`: request/response types dùng ở frontend
- `mappers.ts`: chuyển DTO từ backend thành view model nếu cần

### Backend app-local

```text
worker/
  index.ts
  routes/
    rooms.ts
    apps/
      <app>.ts
  apps/
    <app>/
      handlers.ts
      service.ts
      schema.ts
      types.ts
      game-logic.ts
```

Giải thích:

- `routes/apps/<app>.ts`: parse request, route tới handler
- `handlers.ts`: orchestration theo từng endpoint
- `service.ts`: business logic, tích hợp provider ngoài
- `schema.ts`: validate input/output
- `types.ts`: domain types của app
- `game-logic.ts`: state machine/game rules nếu là game

## Một số rule thực dụng

### 1. Không tạo `src/api/mega-client.ts`

Một file client chung cho mọi app sẽ nhanh chóng thành chỗ khó đọc và khó refactor.

Tốt hơn:

- app nào có API thì tự có `api/client.ts`
- phần shared thì tách ra `src/composables/shared/` hoặc `src/utils/shared/`

### 2. Không nhét backend handler vào `src/views/`

`src/views/` là frontend feature boundary, không phải chỗ để cất route handler.

Chỉ nên để:

- UI
- composables
- frontend API client
- local types

### 3. Shared chỉ khi đã thực sự shared

Chỉ đẩy code lên shared layer khi:

- dùng bởi từ 3 app trở lên
- hoặc nó là hạ tầng nền như auth, rooms, presence, uploads, cache, rate limit

Nếu mới chỉ có 1 app dùng, cứ giữ ownership ở app đó.

### 4. API contract phải nhỏ và rõ

Nên dùng DTO đơn giản:

- `CreateRoomRequest`
- `CreateRoomResponse`
- `SubmitMoveRequest`
- `RoomSnapshotResponse`

Không trả nguyên state nội bộ nếu frontend không cần.

### 5. Validation nằm ở backend

Frontend có thể validate để UX tốt hơn, nhưng backend mới là nơi chốt:

- input shape
- quyền thao tác
- trạng thái room
- giới hạn người chơi
- anti-spam cơ bản

## WebSocket nên thiết kế thế nào

### Frontend

Trong app cần realtime, tạo file local:

```text
src/views/<app>/api/ws.ts
```

File này nên lo:

- mở kết nối
- parse envelope
- gửi message typed
- reconnect nhẹ nếu phù hợp
- expose callback hoặc composable cho UI

Không nên rải `new WebSocket(...)` ở nhiều component khác nhau.

### Backend

WebSocket nên được chia làm 2 lớp:

- shared realtime transport ở `worker/multiplayer/`
- app-specific logic ở `worker/apps/<app>/`

Ví dụ:

- `worker/multiplayer/protocol.ts`: envelope, message types chung
- `worker/multiplayer/validators.ts`: validate payload chung
- `worker/apps/caro/game-logic.ts`: luật chơi caro
- `worker/apps/caro/types.ts`: move, board, phase

### Khi nào dùng WebSocket

Nên dùng khi app cần:

- đồng bộ room theo thời gian thực
- player presence
- turn update nhanh
- countdown
- spectator view

Không nên dùng WebSocket nếu chỉ cần:

- gọi một API lấy dữ liệu
- submit form
- poll theo chu kỳ dài

## Luồng thiết kế khuyến nghị khi tạo app mới

### App chỉ có frontend + public API

```text
src/views/quiz-fun/
  index.vue
  meta.ts
  api/
    client.ts
    types.ts
```

### App có backend HTTP riêng

```text
src/views/word-battle/
  index.vue
  meta.ts
  api/
    client.ts
    types.ts

worker/
  routes/
    apps/
      word-battle.ts
  apps/
    word-battle/
      handlers.ts
      service.ts
      schema.ts
      types.ts
```

### App có room realtime

```text
src/views/caro-online/
  index.vue
  meta.ts
  api/
    client.ts
    ws.ts
    types.ts

worker/
  routes/
    apps/
      caro-online.ts
    rooms.ts
  apps/
    caro-online/
      game-logic.ts
      handlers.ts
      schema.ts
      types.ts
  durable-objects/
    game-room.ts
  multiplayer/
    protocol.ts
    ttl.ts
    validators.ts
```

## Nên dùng file nào cho loại logic nào

- UI fetch đơn giản của riêng app: `src/views/<app>/api/client.ts`
- Type request/response riêng app: `src/views/<app>/api/types.ts`
- WebSocket client riêng app: `src/views/<app>/api/ws.ts`
- Route HTTP nội bộ: `worker/routes/apps/<app>.ts`
- Business logic/backend integration: `worker/apps/<app>/service.ts`
- Luật game/state machine: `worker/apps/<app>/game-logic.ts`
- Primitives dùng lại nhiều app: `worker/multiplayer/*`

## Cách nghĩ đúng để repo không bị loạn

Đừng nghĩ theo kiểu:

- "repo có backend thì mọi API phải đi vào một thư mục chung"

Hãy nghĩ theo kiểu:

- "mỗi app sở hữu frontend client của nó"
- "mỗi app sở hữu backend logic của nó"
- "shared layer chỉ chứa hạ tầng dùng lại"

Đó là cách giữ cho `HACHITU` mở rộng được từ vài mini-app sang nhiều mini-app mà không phải đại tu cấu trúc giữa chừng.
