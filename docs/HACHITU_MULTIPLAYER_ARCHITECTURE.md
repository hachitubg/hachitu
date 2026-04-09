# HACHITU Multiplayer Architecture

Tài liệu này mô tả hướng kiến trúc khuyến nghị để thêm chat room hoặc game online vào `HACHITU` mà vẫn giữ hệ thống gọn, dễ debug và dễ deploy trên VPS.

## Kết luận ngắn

Khuyến nghị mặc định cho `HACHITU` là:

- `Node.js`
- `Socket.IO`
- room state trong memory
- không dùng database ở giai đoạn đầu

Nếu server restart thì room mất. Điều đó chấp nhận được với các app dạng:

- chat bạn bè
- mini game theo phòng
- tool cộng tác ngắn hạn

## Vì sao chọn hướng này

So với kiến trúc realtime phức tạp hơn, mô hình này có lợi thế:

- dễ hiểu
- dễ code
- dễ deploy trên VPS
- dễ gắn vào `nginx`
- không phải quản lý storage hay migration
- phù hợp với project cá nhân

## Khi nào không cần database

Không cần database nếu bạn chỉ muốn:

- tạo room bằng link
- người dùng vào phòng bằng nickname tạm
- đồng bộ realtime trong lúc đang mở room
- tự xóa room khi không còn ai dùng

Ở mức này, state có thể chỉ là:

```ts
type RoomState = {
  roomId: string
  roomName: string
  users: Array<{ id: string; name: string }>
  messages: Array<{ id: string; text: string; userId: string }>
  lastActiveAt: number
}
```

## Kiến trúc tổng thể

```text
Browser
  -> HTTP create/join room
  -> Socket.IO connect to room

Node.js server
  -> route API requests
  -> giữ room state trong Map
  -> broadcast event realtime
  -> cleanup room cũ theo interval

Nginx
  -> serve frontend dist/
  -> reverse proxy /api/*
  -> reverse proxy /socket.io/*
```

## Room lifecycle

### Tạo room

1. Client gọi `POST /api/chat/rooms`
2. Server tạo `roomId`
3. Server tạo room mới trong memory
4. Trả về link mời

### Join room

1. Client gọi `POST /api/chat/rooms/:roomId/join`
2. Server kiểm tra room có tồn tại không
3. Gắn `participantId/sessionId`
4. Trả về thông tin room và identity

### Kết nối realtime

1. Client mở Socket.IO
2. Join vào room tương ứng
3. Server gửi initial state
4. Sau đó chỉ broadcast event hoặc state patch

### Cleanup

- server chạy interval mỗi 1 đến 5 phút
- room nào `lastActiveAt` quá hạn thì xóa khỏi memory

## TTL khuyến nghị

- room chat ngắn: `6h` đến `24h`
- room party game: `2h` đến `12h`
- room turn-based nhẹ: `24h` đến `7 ngày`

## Event model

Các event nên nhỏ và rõ:

- `initial_state`
- `participant_joined`
- `participant_left`
- `presence_updated`
- `typing_updated`
- `message_created`
- `action_rejected`
- `room_expiring`

## Validation rules

Server phải là nơi chốt:

- ai được vào room
- room còn hoạt động hay không
- action có hợp lệ không
- state có hợp lệ không

Không tin dữ liệu gửi lên từ client cho các thứ như:

- điểm số
- quyền host
- trạng thái thắng thua
- lịch sử phòng

## Cấu trúc code khuyến nghị

```text
HACHITU/
  server/
    index.mjs
    routes/
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

## Khi nào mới cần database

Chỉ thêm database khi bạn thực sự cần:

- tài khoản người dùng
- lịch sử room dài hạn
- leaderboard
- analytics
- khôi phục state sau restart

Nếu chưa cần các thứ này, `Socket.IO + memory state` là đủ.
