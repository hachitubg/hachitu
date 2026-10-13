# Bẫy 21

Mini-game tại `/trap-21`, tự hiển thị trên trang chủ trong danh mục Trò chơi.

- Đấu với máy hoặc hai người cùng một thiết bị.
- Mỗi lượt cộng 1, 2 hoặc 3; ai chạm 21 thua. Thắng 3 ván trước thắng trận.
- Luân phiên người mở đầu qua từng ván. Đổi chế độ hoặc chơi lại sẽ xóa tỉ số trận hiện tại.
- Điện thoại: chạm nút. PC: dùng chuột hoặc các phím 1, 2, 3.
- Trạng thái chỉ tồn tại trong phiên trang, không cần API hay database.

`utils/game.ts` chứa luật và lựa chọn của máy. Máy kết hợp nước đi chiến lược và ngẫu nhiên.
`index.vue` quản lý tỉ số, giao diện và lượt máy bằng VueUse; timer và sự kiện được dọn khi rời trang.

Kiểm tra: `pnpm test:unit --run src/views/trap-21/utils/game.test.ts` và `pnpm build`.
