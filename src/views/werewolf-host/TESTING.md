# Kiểm thử tổ hợp Ma Sói

## Phạm vi

Kiểm thử tổ hợp dùng 50 role đã có logic tự động. Những role chưa có logic chỉ được kiểm tra trong chế độ chia bài. Không dùng database, không gọi server production và không tạo phòng trên VPS khi chạy bộ audit này.

### Ma trận tự động

- 1.229 cặp role hợp lệ, gồm cả cặp trùng nếu bộ bài có đủ bản sao. Mỗi cặp chạy với ba chính sách: chủ động dùng kỹ năng, giữ kỹ năng và thay đổi lựa chọn theo seed. Tổng 3.687 ván.
- 19.799 bộ ba role hợp lệ, tính cả lá trùng theo số bản sao vật lý; mỗi bộ ba chạy một seed và một chính sách.
- Mỗi cặp/bộ ba được đặt trong bộ bài hợp lệ 9 người, thêm Sói, Tiên tri hoặc Hội Tam điểm khi cần để thỏa điều kiện chia bài. Vì thế đây là bao phủ sự hiện diện cặp/bộ ba trong một ván, không phải vét cạn mọi lựa chọn mục tiêu của từng tổ hợp.
- Thêm 5.000 bộ bài ngẫu nhiên hợp lệ từ 5 đến 24 người, 250 ván cho từng mức người chơi. Có chọn lá ẩn Kẻ say rượu và kiểm tra số bản sao.
- Tổng một lượt đầy đủ: **28.486 ván mô phỏng**. Mọi ván phải kết thúc trong giới hạn thao tác; nếu hết giới hạn, audit thất bại để kiểm tra đó là thế bế tắc hợp lệ hay kẹt pha.

### Chế độ chỉ dùng bộ bài

142 nhóm kiểm thử Node hiện có một nhóm vét **67 loại nhân vật × 20 mức người chơi = 1.340 ván chia bài**. Kiểm tra đúng bộ bài được chia, kín danh tính, không tự chạy kỹ năng, chỉ quản trò kết thúc, không cộng điểm và có thể mở ván mới.

### Bất biến và thao tác lỗi

- Revision không lùi, không tính điểm/kết thúc cùng ván hai lần.
- Không gửi token, bản chụp reset, log hoặc role bí mật trong view người chơi.
- Không để người chết thao tác trừ vai có quyền sau chết, không mất lượt bắn cuối của Thợ săn.
- Hai người yêu phải chết theo nhau; Sói đau khổ đang sống không thể liên kết với một người đã chết, kể cả vừa kế thừa.
- Reset ở bình minh, vote, Kẻ tử đạo và bước kiểm tra cuối ngày; xác nhận người sống/chết và dữ liệu lượt được phục hồi.
- Mô phỏng mất kết nối người có lượt, bao gồm người đã chết; ván dừng và tiếp tục đúng khi kết nối lại.
- Lệnh cũ, lệnh sai quyền, xác nhận kỹ năng/phiếu trùng phải bị từ chối và không làm thay đổi room.
- Kiểm tra đồng hồ không chuyển pha trước deadline.

Socket.IO thật được kiểm tra riêng với nhiều client: gửi phiếu đồng thời/trùng, Xác ướp tác động trọng số Thị trưởng, quản trò chờ quyết định hy sinh, Kẻ tử đạo mất kết nối rồi vào lại, Bloody Mary vào lại khi đã chết, khôi phục vai/token, hoàn tác kết quả và rematch. Các ca này chạy server tạm trên cổng ngẫu nhiên và dọn sau test.

## Chạy kiểm tra

```sh
pnpm test:werewolf
pnpm test:werewolf:matrix
pnpm test:werewolf:audit
pnpm test:unit --run
pnpm build
pnpm lint:ci
```

- `test:werewolf`: các ca luật có kết quả kỳ vọng cụ thể, regression, ma trận chia bài và kiểm thử Socket.IO thật.
- `test:werewolf:matrix`: mọi cặp với một chính sách, thêm 200 ván ngẫu nhiên; chạy trong CI mỗi lần push/PR.
- `test:werewolf:audit`: toàn bộ cặp với ba chính sách, toàn bộ bộ ba và 5.000 ván ngẫu nhiên.
- Chạy nhanh để sửa bộ mô phỏng: `node server/werewolf/audit.mjs --mode=smoke` (100 ván).

Báo cáo sinh tại `server/werewolf/test-results/audit-full.json` (hoặc `audit-ci.json`, `audit-smoke.json`). Có checksum SHA-256 engine và simulator, chính sách seed, số cặp/bộ ba đã đạt, số người, lượt pha/kỹ năng, reset, ngắt kết nối mô phỏng và lệnh bị từ chối. Thư mục kết quả được gitignore.

Lỗi lưu thành `failure-<mode>-<n>.json`, gồm bộ bài, lá ẩn, seed, chính sách, pha và 80 thao tác gần nhất bằng chỉ số người chơi, không lưu token. Tái hiện sau khi sửa:

```sh
node server/werewolf/replay.mjs server/werewolf/test-results/failure-ci-1.json
```

File lỗi cũ được giữ để tái hiện; hãy xem trường `failed` và checksum trong báo cáo mới nhất, không suy từ việc còn file failure cũ.

## Lỗi thực tế tìm được

Audit đã tìm lỗi Người nhân bản kế thừa Sói đau khổ khi mục tiêu liên kết đã chết nhưng vẫn sống. Đã xác nhận ca hồi quy thất bại trước sửa, sửa engine để chết dây chuyền ngay (bảo hộ không chặn), chạy lại seed gây lỗi và toàn bộ ma trận. Ví dụ seed `9002605` tái hiện được với chính sách `active` và bật mô phỏng lỗi kết nối/reset.

## Giới hạn cần hiểu đúng

Đạt toàn bộ cặp/bộ ba không đồng nghĩa mọi thứ tự hành động, mọi bộ bốn trở lên hoặc mọi nhánh luật đều đã được vét cạn. Bộ mô phỏng kiểm tra các bất biến; kết quả kỹ năng cụ thể được đối chiếu bằng các ca regression/luật riêng. Không phải chứng minh hình thức rằng engine không còn lỗi.

Chưa tự động kiểm chứng được việc người chơi nói từ khóa ngoài đời, hành vi trình duyệt thật trên mọi điện thoại, mất gói kéo dài hoặc độ trễ mạng production. Quản trò vẫn xác nhận Sói tuổi teen; những biến thể luật đang áp dụng được công bố trong README và `guide_vi`.
