# HACHITU Multiplayer Architecture

Tài liệu này mô tả kiến trúc đề xuất để thêm các trò chơi online giữa bạn bè vào `HACHITU` mà vẫn giữ hệ thống gọn, rẻ, và dễ vận hành.

## Mục tiêu

- Hỗ trợ game realtime giữa bạn bè
- Không cần hệ thống account phức tạp ở giai đoạn đầu
- Có thể tạo room nhanh bằng link mời
- Trạng thái trận đấu tồn tại đủ lâu để reconnect
- Tự dọn dữ liệu cũ mà không cần "xóa sạch toàn bộ database"

## Kết luận kiến trúc

**Khuyến nghị chính:**

- Dùng **Cloudflare Durable Objects** để quản lý từng room game
- Dùng **WebSocket** để đồng bộ realtime giữa các người chơi
- Dùng **SQLite-backed Durable Object storage** để snapshot state ngắn hạn
- Dùng **Alarms** để xóa room hết hạn hoặc không hoạt động
- Chỉ dùng **D1** nếu sau này cần leaderboard, hồ sơ người chơi, hoặc lịch sử dùng chung toàn hệ thống

## Vì sao không nên dùng một SQLite global rồi xóa mỗi tuần

Mô hình "một database chung, mỗi tuần xóa toàn bộ" nghe đơn giản nhưng có nhiều nhược điểm:

- Có thể xóa nhầm room đang chơi dở
- Khó debug vì dữ liệu biến mất đồng loạt
- Không phù hợp khi mỗi room có vòng đời khác nhau
- Không tối ưu cho realtime room-based game
- Sau này mở rộng sang leaderboard hay reconnect sẽ phải refactor mạnh

Giải pháp tốt hơn là:

- mỗi room có lifecycle riêng
- room nào hết hạn thì xóa room đó
- dữ liệu toàn cục thì lưu riêng

## Kiến trúc tổng thể

```text
Browser
  -> HTTP create/join room
  -> WebSocket connect to room

Cloudflare Worker
  -> route API requests
  -> resolve roomId -> Durable Object instance
  -> forward WebSocket upgrade

Durable Object (1 room = 1 instance logic)
  -> giữ state realtime của room
  -> broadcast event qua WebSocket
  -> snapshot state vào SQLite storage của chính room
  -> đặt alarm để cleanup khi room hết hạn

Optional D1
  -> leaderboard toàn hệ thống
  -> analytics game
  -> hồ sơ người chơi / alias lâu dài
```

## Room model

Mỗi `roomId` đại diện cho một trận hoặc một phòng chơi.

### Một room nên chứa

- `roomId`
- `gameType`
- `createdAt`
- `lastActiveAt`
- `expiresAt`
- `status`
  - `waiting`
  - `countdown`
  - `playing`
  - `finished`
  - `abandoned`
- `players`
- `spectators` nếu cần
- `gameState`
- `eventSequence`

### Player model tối thiểu

- `playerId`
- `sessionId`
- `displayName`
- `joinedAt`
- `connected`
- `isHost`

## State strategy

### Trong memory

Giữ:

- state hiện tại của room
- map WebSocket connections
- timers ngắn
- turn state / physics tick / pending inputs

### Trong SQLite storage của Durable Object

Lưu:

- metadata của room
- snapshot state định kỳ
- event log ngắn hạn nếu game cần replay/reconnect
- danh sách player hiện tại

### Không nên lưu quá nhiều

Không nên lưu:

- full analytics lâu dài
- asset game
- chat history dài
- replay lớn nhiều MB

## Vòng đời room

### Tạo room

1. Client gọi `POST /api/rooms`
2. Worker tạo `roomId`
3. Worker resolve sang Durable Object instance
4. Durable Object khởi tạo room metadata
5. Trả về link mời và thông tin join

### Join room

1. Client gọi `POST /api/rooms/:roomId/join`
2. Worker forward sang Durable Object
3. Durable Object xác thực trạng thái room
4. Tạo hoặc cập nhật player session
5. Trả về token/session info nếu cần

### Kết nối realtime

1. Client mở WebSocket tới `GET /api/rooms/:roomId/ws`
2. Worker chuyển upgrade request tới Durable Object
3. Durable Object nhận socket, gắn với `playerId/sessionId`
4. Gửi initial state cho client mới
5. Broadcast event `player_joined` tới room

### Trong lúc chơi

- Client gửi action qua WebSocket
- Durable Object validate action
- Durable Object cập nhật state
- Durable Object broadcast state patch hoặc event tới các client
- Định kỳ snapshot state vào storage

### Kết thúc room

- room finished
- hoặc tất cả người chơi rời room quá lâu
- hoặc room quá hạn TTL

Khi đó:

- Durable Object đánh dấu `finished` hoặc `expired`
- xóa socket map
- xóa snapshot/event log nếu không cần giữ

## Cleanup policy đề xuất

### Không dùng weekly wipe toàn cục

Thay vào đó:

- mỗi room có `expiresAt`
- mỗi lần có activity thì cập nhật `lastActiveAt`
- mỗi room tự đặt `alarm()` cho lần cleanup tiếp theo

### TTL gợi ý

- room waiting chưa đủ người: `24 giờ`
- room đang chơi: `24 giờ kể từ hoạt động cuối`
- room finished: `6 giờ` hoặc `24 giờ`
- room party game ngắn: `2 giờ đến 12 giờ`
- room board game / turn-based nhẹ: `3 ngày đến 7 ngày`

### Nếu bạn vẫn muốn reset theo tuần

Đừng xóa toàn bộ DB.

Thay vào đó:

- dùng **Cron Trigger** mỗi tuần để quét room cũ
- chỉ xóa room có `expiresAt < now`
- giữ nguyên room mới hoặc còn hoạt động

## WebSocket contract

### Client -> server

Ví dụ envelope:

```json
{
  "type": "player_action",
  "roomId": "abc123",
  "playerId": "p1",
  "seq": 14,
  "payload": {
    "action": "move",
    "x": 4,
    "y": 2
  }
}
```

### Server -> client

Ví dụ envelope:

```json
{
  "type": "state_patch",
  "roomId": "abc123",
  "serverTime": 1740000000,
  "version": 22,
  "payload": {
    "turn": "p2",
    "board": []
  }
}
```

### Các message type nên có

- `hello`
- `initial_state`
- `player_joined`
- `player_left`
- `presence`
- `player_action`
- `action_rejected`
- `state_patch`
- `state_full`
- `game_started`
- `game_finished`
- `room_expiring`
- `ping`
- `pong`

## Validation rules

Durable Object phải là nơi ra quyết định cuối cùng.

Không tin client cho các thứ sau:

- thứ tự lượt
- điểm số
- trạng thái thắng thua
- random seed
- quyền host
- reconnect identity nếu không có session hợp lệ

## Chọn chiến lược sync

### Với turn-based game

Nên dùng:

- event-based sync
- gửi action hợp lệ
- broadcast state patch

Ví dụ:

- cờ caro
- cờ vua đơn giản
- Uno-like
- game bài theo lượt

### Với action game nhanh

Nên dùng:

- tick-based room state
- gom input theo frame hoặc interval ngắn
- snapshot định kỳ

Ví dụ:

- arena nhỏ
- đua xe đơn giản
- tank battle đơn giản

### Với party game

Nên dùng:

- state machine rõ ràng theo phase
- timer do Durable Object giữ
- broadcast phase transition

Ví dụ:

- đoán chữ
- quiz room
- vẽ và đoán

## Auth nhẹ cho bạn bè

Ở giai đoạn đầu, không cần account thật.

Nên dùng:

- `displayName` tự nhập
- `sessionId` ngẫu nhiên lưu localStorage
- host token ngắn hạn cho người tạo room
- invite link chứa `roomId`

Nếu cần chống phá nhẹ:

- thêm `roomCode`
- thêm `maxPlayers`
- thêm `private room secret`

## API shape đề xuất

### HTTP

- `POST /api/rooms`
- `POST /api/rooms/:roomId/join`
- `GET /api/rooms/:roomId`
- `POST /api/rooms/:roomId/leave`
- `POST /api/rooms/:roomId/start`

### WebSocket

- `GET /api/rooms/:roomId/ws`

## Cấu trúc code đề xuất cho bước triển khai

```text
HACHITU/
  worker/
    index.ts
    routes/
      rooms.ts
      apps/
        <app>.ts
    apps/
      <app>/
        game-logic.ts
        handlers.ts
        schema.ts
        types.ts
    durable-objects/
      game-room.ts
    multiplayer/
      protocol.ts
      room-types.ts
      validators.ts
      ttl.ts
      ws.ts
```

Nếu app cần thêm HTTP API hoặc WebSocket client riêng ngoài room core, xem thêm:

- `docs/HACHITU_APP_API_GUIDELINES.md`

## Điều chỉnh deployment hiện tại

Repo `HACHITU` hiện đang là mô hình assets-first cho SPA.

Khi thêm multiplayer backend, nên chuyển sang:

- Worker có `main` entry
- vẫn serve static assets từ `dist`
- cùng lúc handle API và WebSocket upgrade

Nói cách khác:

- frontend vẫn là Vite build
- backend realtime chạy ngay trong Cloudflare Worker + Durable Objects

## Khi nào mới cần D1

Chỉ thêm D1 khi bạn thực sự cần một trong các thứ sau:

- leaderboard toàn cục
- thống kê nhiều room
- user profile lâu dài
- match history lâu dài
- admin dashboard

Nếu chưa cần, Durable Objects + SQLite room storage là đủ.

## Đề xuất cho phiên bản đầu tiên

### v1 multiplayer

- 1 loại game turn-based đơn giản
- room private theo link
- 2 đến 4 người chơi
- WebSocket realtime
- reconnect trong thời gian ngắn
- TTL cleanup theo room
- không có account
- không có leaderboard

### v2

- spectator mode
- rematch
- room history ngắn hạn
- basic anti-spam
- host controls

### v3

- D1 leaderboard
- profile
- analytics
- nhiều game dùng chung multiplayer layer

## Chốt quyết định kỹ thuật

Nếu mục tiêu của bạn là "trò chơi online giữa bạn bè" thì hướng khởi đầu tốt nhất là:

- **Durable Objects**
- **WebSocket**
- **SQLite-backed room storage**
- **cleanup theo TTL của từng room**

Đó là hướng cân bằng tốt nhất giữa độ đơn giản, realtime, chi phí và khả năng mở rộng.
