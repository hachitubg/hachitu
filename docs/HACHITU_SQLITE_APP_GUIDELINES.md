# HACHITU SQLite App Guidelines

Tài liệu này chốt cách thêm `SQLite` vào `HACHITU` cho các mini-app cần lưu dữ liệu có cấu trúc.

Mục tiêu của tài liệu:

- giữ đúng tinh thần `launcher + nhiều mini-app độc lập`
- chỉ app nào thực sự cần SQL mới dùng `SQLite`
- mỗi app có database riêng, schema riêng, migration riêng
- tránh biến `HACHITU` thành một monolith có tầng database dùng chung cho mọi app

Đây là guideline mặc định cho dự án. Khi AI hoặc lập trình viên thêm app mới có dùng SQL, phải đọc và tuân thủ tài liệu này trước khi thiết kế code.

## Kết luận ngắn

Khuyến nghị mặc định cho app cần SQL trong `HACHITU` là:

- dùng `SQLite`
- mỗi app một database riêng
- mỗi app tự giữ `db.ts`, `repository.ts`, `schema.sql` hoặc `migrations/`
- không tạo `server/db/global.ts` cho tất cả app dùng chung
- không ép app không cần persistence phải kéo theo database

Nói ngắn gọn:

- `server/apps/<app>/` là boundary logic và database của app đó
- database của app nào chỉ phục vụ app đó
- chỉ tách shared layer khi đã có nhu cầu thực sự từ nhiều app

## Vì sao chọn hướng này

`HACHITU` được tổ chức theo mô hình nhiều mini-app độc lập. Vì vậy, database cũng nên đi theo cùng một boundary.

Lợi ích của mô hình `mỗi app một SQLite`:

- dễ hiểu
- dễ code
- dễ backup
- dễ reset dữ liệu của từng app
- không làm app này ảnh hưởng app khác
- dễ bỏ hẳn persistence ở các app không cần

Đây là mô hình phù hợp với các app như:

- trip planner
- score board có lịch sử riêng
- AI chat có lưu conversation cục bộ
- tool cá nhân có note, template, draft, preset

## Nguyên tắc chốt

### 1. SQLite là opt-in theo app

Không phải mọi app trong `HACHITU` đều có database.

Chỉ thêm `SQLite` khi app thực sự cần một trong các nhu cầu sau:

- lưu dữ liệu có cấu trúc
- query/filter/sort bằng SQL
- lưu lịch sử qua nhiều phiên
- cần transaction đơn giản
- cần migration schema theo thời gian

Nếu app chỉ cần:

- state trong bộ nhớ
- cache tạm
- room realtime mất khi restart
- dữ liệu chỉ dùng trong phiên

thì không thêm `SQLite`.

### 2. Mỗi app một database riêng

Không dùng một file SQLite lớn cho toàn bộ dự án.

Khuyến nghị:

```text
data/
  sqlite/
    trip-planner.db
    score-board.db
    ai-chat.db
```

Tên file nên bám đúng slug app để dễ đoán, dễ backup và dễ bảo trì.

### 3. Mỗi app tự sở hữu SQL layer của nó

Không tạo tầng query dùng chung theo kiểu:

```text
server/
  db/
    client.ts
    repositories/
```

cho tất cả app ngay từ đầu.

Thay vào đó, giữ database layer ngay trong app:

```text
server/
  apps/
    trip-planner/
      db.ts
      repository.ts
      service.ts
      schema.sql
      types.ts
```

Hoặc nếu app đã phức tạp hơn:

```text
server/
  apps/
    trip-planner/
      db/
        client.ts
        migrations/
        queries.ts
      repository.ts
      service.ts
      types.ts
```

### 4. Không tạo global SQLite abstraction quá sớm

Không thêm các tầng abstraction nặng như:

- `BaseRepository`
- `AbstractSqlService`
- `GlobalDatabaseManager`
- `shared query builder` cho mọi app

trừ khi đã có nhu cầu thực sự từ nhiều app.

Trong giai đoạn đầu, code nên ưu tiên:

- trực tiếp
- dễ đọc
- dễ debug
- ít magic

### 5. Shared chỉ được tách khi thật sự shared

Chỉ tách phần dùng chung lên shared layer nếu:

- đã có từ 3 app trở lên dùng cùng một logic
- hoặc đó là hạ tầng thật sự nền như migration runner, logging, backup utility

Không được tách shared chỉ vì “có thể sau này sẽ dùng lại”.

## Cấu trúc khuyến nghị

### App chỉ cần SQLite đơn giản

```text
server/
  apps/
    score-board/
      db.ts
      repository.ts
      schema.sql
      service.ts
      types.ts
```

Ý nghĩa:

- `db.ts`: mở database, init schema, export hàm lấy connection
- `schema.sql`: schema ban đầu của app
- `repository.ts`: câu lệnh query/insert/update/delete
- `service.ts`: business logic của app
- `types.ts`: DTO và kiểu dữ liệu nội bộ

### App có nhiều migration

```text
server/
  apps/
    trip-planner/
      db/
        client.ts
        migrations/
          001_init.sql
          002_add_tags.sql
      repository.ts
      service.ts
      types.ts
```

Khuyến nghị dùng cách này khi app đã có evolution schema thực sự.

## Quy ước đường dẫn database

Khuyến nghị mặc định:

```text
data/sqlite/<app-slug>.db
```

Ví dụ:

- `data/sqlite/trip-planner.db`
- `data/sqlite/score-board.db`
- `data/sqlite/ai-chat.db`

Rule:

- không đặt file `.db` trong `src/`
- không đặt file `.db` trong `public/`
- không commit dữ liệu runtime thật vào git trừ khi đó là seed hoặc sample riêng

## Rule môi trường

Mỗi app có thể có config riêng, nhưng nên giữ mẫu rõ ràng:

```text
<APP>_SQLITE_PATH
```

Ví dụ:

- `TRIP_PLANNER_SQLITE_PATH`
- `SCORE_BOARD_SQLITE_PATH`

Nếu không có env var, backend có thể fallback về path mặc định trong `data/sqlite/<app>.db`.

Không dùng một env var chung kiểu:

- `SQLITE_PATH`
- `DATABASE_PATH`

cho toàn bộ app nếu điều đó làm mất boundary theo app.

## Data retention, TTL và cleanup

`SQLite` không tự động xóa dữ liệu theo thời gian.

Điều này có nghĩa là nếu app ghi dữ liệu vào database mà không có cleanup policy, file `.db` sẽ tiếp tục lớn dần theo thời gian.

Với `HACHITU`, đây là một rule rất quan trọng:

- app nhỏ không được giữ dữ liệu vô thời hạn một cách mặc định
- mọi app dùng `SQLite` phải xác định rõ retention policy
- nếu dữ liệu là tạm thời hoặc giá trị thấp, phải có TTL hoặc cleanup strategy

### 1. Cleanup là mặc định, không phải tùy chọn

Khi thêm `SQLite` cho một app, AI và lập trình viên phải trả lời rõ:

- dữ liệu nào cần giữ lâu dài
- dữ liệu nào chỉ là tạm thời
- dữ liệu nào phải tự xóa sau một khoảng thời gian

Nếu không có lý do nghiệp vụ rõ ràng để giữ mãi, mặc định phải chọn một chính sách cleanup.

### 2. Phân loại dữ liệu trước khi lưu

Trước khi thiết kế schema, phải chia dữ liệu thành một trong các nhóm sau:

- dữ liệu ngắn hạn
- dữ liệu trung hạn
- dữ liệu lâu dài

Ví dụ:

- room/session tạm: vài giờ đến vài ngày
- cache hoặc draft: vài ngày đến vài tuần
- lịch sử quan trọng người dùng thật sự cần: dài hạn

Chỉ nhóm dài hạn mới nên được giữ vô thời hạn.

### 3. Bảng có dữ liệu tạm phải có cột phục vụ cleanup

Khuyến nghị dùng ít nhất một trong các trường sau:

- `created_at`
- `updated_at`
- `last_accessed_at`
- `expires_at`

Trong đó:

- `expires_at` phù hợp với TTL rõ ràng
- `last_accessed_at` phù hợp với dữ liệu kiểu cache hoặc dữ liệu ít dùng thì xóa
- `created_at` và `updated_at` giúp dọn theo tuổi dữ liệu

### 4. Mỗi app phải tự sở hữu cleanup policy của nó

Không tạo một cleanup job toàn cục cho tất cả app ngay từ đầu.

Thay vào đó:

- app nào có DB thì app đó tự có rule cleanup
- cleanup logic nằm trong boundary của app
- chỉ tách shared cleanup runner khi đã có nhiều app cùng cần và logic thực sự giống nhau

### 5. Cleanup nên chạy định kỳ

Khuyến nghị cho app nhỏ:

- chạy cleanup khi server start
- chạy lại theo interval như mỗi `1h`, `6h`, hoặc `24h`
- hoặc chạy opportunistic cleanup khi có request mới vào app

Không cần scheduler quá phức tạp ở giai đoạn đầu, nhưng phải có ít nhất một cách dọn dữ liệu cũ.

### 6. Sau khi xóa nhiều dữ liệu, cân nhắc `VACUUM`

Xóa record trong SQLite không có nghĩa là file `.db` sẽ nhỏ lại ngay.

Nếu app có các đợt xóa lớn:

- có thể chạy `VACUUM` định kỳ
- hoặc chạy trong job bảo trì riêng

Không nên chạy `VACUUM` quá thường xuyên trên mọi request vì có chi phí I/O.

### 7. Retention policy phải được ghi rõ trong code hoặc docs của app

Mỗi app có `SQLite` nên ghi rõ:

- dữ liệu nào được lưu
- giữ trong bao lâu
- cleanup chạy khi nào

Điều này có thể nằm ở:

- `server/apps/<app>/README.md`
- comment ngắn trong `db.ts`
- hoặc docs riêng của app nếu app đủ lớn

## Retention policy gợi ý

Đây là gợi ý mặc định cho project nhỏ như `HACHITU`. App có thể điều chỉnh, nhưng không nên giữ vô thời hạn nếu không cần thiết.

### Dữ liệu tạm

- session tạm: `24h`
- room snapshot: `6h` đến `24h`
- cache API: `1h` đến `24h`
- typing/presence snapshot: không nên lưu vào SQLite trừ khi có lý do rõ ràng

### Dữ liệu trung hạn

- draft: `7` đến `30 ngày`
- chat history nhẹ: `7` đến `30 ngày`
- lịch sử thao tác gần đây: `14` đến `30 ngày`

### Dữ liệu dài hạn

- user-created content thực sự quan trọng
- cấu hình do người dùng chủ động lưu
- dữ liệu nghiệp vụ có yêu cầu giữ lại

Nhóm này có thể không cần TTL, nhưng vẫn nên có rule archive, giới hạn số lượng, hoặc cleanup theo nghiệp vụ nếu có thể.

## Mẫu chiến lược cleanup

### 1. TTL theo `expires_at`

Phù hợp với:

- cache
- draft tạm
- session
- token nội bộ

Ví dụ query:

```sql
DELETE FROM app_cache
WHERE expires_at IS NOT NULL
  AND expires_at <= unixepoch();
```

### 2. Cleanup theo tuổi dữ liệu

Phù hợp với:

- log
- history
- dữ liệu chỉ cần giữ một khoảng thời gian cố định

Ví dụ query:

```sql
DELETE FROM chat_messages
WHERE created_at < unixepoch() - (7 * 24 * 60 * 60);
```

### 3. Cleanup theo số lượng tối đa

Phù hợp với:

- activity log
- search history
- result cache

Ví dụ:

- chỉ giữ `1000` bản ghi mới nhất
- xóa phần cũ hơn theo `created_at`

### 4. Cleanup hỗn hợp

Phù hợp với app lớn hơn một chút.

Ví dụ:

- session: TTL `24h`
- draft: TTL `30 ngày`
- log: chỉ giữ `1000` bản ghi gần nhất

## Rule bắt buộc cho AI khi thêm schema mới

Khi AI thêm bảng mới vào app có `SQLite`, phải tự hỏi:

1. Bảng này có cần giữ dữ liệu vô thời hạn không?
2. Nếu không, TTL hoặc retention policy là gì?
3. Cột nào được dùng để cleanup?
4. Cleanup query sẽ nằm ở đâu?
5. Cleanup được gọi khi nào?

Nếu AI không trả lời được các câu hỏi này, không được coi phần thiết kế database là hoàn chỉnh.

## Rule code cho AI và lập trình viên

Khi thêm một app mới có dùng `SQLite`, phải tuân thủ các rule sau:

### 1. Không được thêm SQLite vào frontend

`SQLite` là backend concern.

Không viết code truy cập database trong:

- `src/views/`
- `src/composables/`
- `src/components/`

Frontend chỉ gọi API nội bộ của app.

### 2. Không được đặt query SQL trong route handler nếu app đã có service layer

Route chỉ nên:

- parse request
- validate input cơ bản
- gọi service
- trả response

SQL nên nằm trong `repository.ts` hoặc `db/queries.ts`.

### 3. Không được dùng chung bảng giữa nhiều app trừ khi đã có quyết định kiến trúc rõ ràng

Ví dụ không nên làm:

- app A ghi vào bảng của app B
- app C join trực tiếp dữ liệu của app D

Nếu nhiều app cần chung dữ liệu, đó là dấu hiệu cần thiết kế lại boundary, không phải dấu hiệu để vá nhanh bằng query chéo.

### 4. Không được tạo “core database module” chỉ để cho đẹp kiến trúc

Nếu mới chỉ có 1 hoặc 2 app dùng SQL, cứ giữ code gần app đó.

### 5. Migration phải thuộc sở hữu của app

Không gom migration của toàn dự án vào một chỗ nếu mỗi app có DB riêng.

Khuyến nghị:

```text
server/apps/<app>/schema.sql
```

hoặc:

```text
server/apps/<app>/db/migrations/
```

### 6. Seed data là tùy chọn, không mặc định

Chỉ thêm seed khi:

- cần demo
- cần dữ liệu development
- cần test local thuận tiện

Nếu có, nên để ngay trong boundary của app.

## Mẫu tổ chức code khuyến nghị

```text
server/
  routes/
    apps/
      trip-planner.ts
  apps/
    trip-planner/
      db.ts
      repository.ts
      service.ts
      schema.sql
      types.ts
data/
  sqlite/
    trip-planner.db
```

Luồng dữ liệu:

1. frontend gọi `POST /api/apps/trip-planner/...`
2. route của app nhận request
3. route gọi `service.ts`
4. `service.ts` gọi `repository.ts`
5. `repository.ts` dùng `db.ts` để query vào `data/sqlite/trip-planner.db`

## Khi nào không nên chọn SQLite riêng cho từng app

Không nên dùng mô hình này nếu nhu cầu thật sự là:

- user account dùng chung cho toàn hệ thống
- permission dùng chung
- analytics toàn site
- search/index toàn cục
- report hoặc query xuyên nhiều app

Trong các trường hợp đó, cần quyết định lại kiến trúc dữ liệu ở mức hệ thống thay vì tiếp tục nhân thêm file SQLite riêng.

## Quan hệ với realtime và in-memory room

Tài liệu này không thay thế kiến trúc realtime hiện tại.

Nếu app là:

- chat room ngắn hạn
- game room ngắn hạn
- state realtime chỉ sống trong phiên

thì ưu tiên:

- memory state
- TTL cleanup

SQLite chỉ nên được thêm nếu app đó thật sự cần persistence sau restart hoặc cần query dữ liệu lịch sử.

## Quan hệ với Cloudflare Worker và Durable Object

Repo hiện có cả hướng `Node server` và `Worker`.

Guideline này áp dụng trực tiếp, rõ ràng nhất cho các app backend chạy theo mô hình `Node server` trong `server/`.

Nếu app chạy hoàn toàn trên `Cloudflare Worker` hoặc `Durable Object`, không được giả định rằng nó dùng cùng mô hình file `.db` local như Node.

Trong trường hợp đó:

- vẫn giữ nguyên nguyên tắc boundary theo app
- nhưng storage implementation có thể khác
- không được copy-paste máy móc path `data/sqlite/<app>.db` vào Worker runtime

Nói cách khác:

- boundary của app vẫn giữ
- implementation storage phụ thuộc runtime

## Checklist bắt buộc trước khi AI thêm SQLite cho một app

AI phải tự kiểm tra các câu hỏi sau:

1. App này có thực sự cần persistence hay chỉ cần memory state?
2. Dữ liệu của app này có độc lập với app khác không?
3. Có thể giữ database layer hoàn toàn trong `server/apps/<app>/` không?
4. File database của app đã được đặt tên theo slug app chưa?
5. Migration/schema đã thuộc sở hữu riêng của app chưa?
6. Frontend đã chỉ gọi API thay vì chạm vào database chưa?
7. App đã có retention policy hoặc cleanup policy rõ ràng chưa?
8. Các bảng tạm đã có `expires_at`, `created_at`, `updated_at` hoặc trường tương đương chưa?
9. Cleanup logic đã nằm trong boundary của app chưa?
10. Có vô tình tạo global database abstraction hoặc global repository không?

Nếu một thay đổi vi phạm các câu hỏi trên, AI phải dừng và thiết kế lại theo đúng guideline này.

## Kết luận

Hướng mặc định của `HACHITU` cho app cần SQL là:

- `SQLite`
- opt-in theo app
- mỗi app một database riêng
- database layer nằm trong boundary của app
- không tạo global SQL architecture quá sớm

Đây là cách phù hợp nhất với mô hình mini-app độc lập, giúp repo giữ được sự gọn, rõ và dễ mở rộng về sau.
