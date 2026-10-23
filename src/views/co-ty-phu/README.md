# HACHI CAPITAL · Cờ Tỷ Phú

## Màn chơi và công trình

Màn chơi dùng chiều cao viewport, tự đo vùng bàn bằng VueUse `useElementSize` để vừa cả desktop/mobile. Chỉ giữ HUD, danh sách quân gọn, bàn cờ và thanh hành động. Tài sản/người chơi/nhật ký/hiển thị mở bằng nút trên thanh công cụ; panel thật được Teleport vào dialog, không nhân đôi logic. Quyết định bắt buộc vẫn mở ở giữa màn hình.

`PropertyBuildings.vue` là artwork vector gốc của HACHITU: 1/2/3/4 căn nhà và một khách sạn có hình khác nhau. Ô đang xây hiển thị công trình theo `Property.level` từ server, không còn chỉ là con số. Khi đổi cấp dùng transition xây/bán; thẻ tài sản có bản xem lớn và thang tiến độ. Xây đều/tối đa 4 nhà rồi khách sạn vẫn giữ luật hiện có. Hiệu ứng theo nút Hiệu ứng, giảm chuyển động khi tắt. Bản xem phát triển công trình ở dev: `/src/views/co-ty-phu/__tests__/fixtures/development.html`; không phải route production và không thay dữ liệu phòng thật.

## Đồ họa, máy và quyết định giữa màn hình

- Dùng trực tiếp 3 cảnh SVG `light`, `summer`, `autumn` và bộ icon Cơ hội/Cộng đồng/nhà tù gốc của Poorup. Nguồn, commit và MIT nằm trong `public/co-ty-phu/poorup-art/README.md`, LICENSE.txt; không còn dùng cảnh thành phố tự vẽ cũ. Chọn khung cảnh trên thiết bị, không thay luật phòng.
- Chủ phòng bấm **Thêm máy vào bàn** ở phòng chờ, tối đa 6 chỗ tổng. Máy tự sẵn sàng, có nhân vật random không trùng; có thể xóa máy trước ván. Giữ máy trong rematch.
- Bot chạy phía server, quyết định bằng luật (không gọi AI/API): gieo, mua hoặc đấu giá, trả giá theo ngân sách, xây đều khi đủ bộ màu, chuộc khi dư tiền, xử lý tù, thanh lý/thế chấp khi nợ và phá sản khi không còn cách trả. Bot trả lời giao dịch của người theo giá trị tài sản/tiền, chưa chủ động khởi tạo thương lượng hoặc có chiến thuật như người chơi giỏi.
- Driver chờ 750ms cho mỗi quyết định và chờ xong presentation của server. Dừng khi có người thật cần thao tác hoặc phòng pause; không điều khiển hộ người. Room đóng/hết hạn thì dọn driver. Rời phòng khi chỉ còn máy ở lobby/ended sẽ đóng room.
- Mua đất, lượt đấu giá, trả nợ, đề nghị giao dịch, tù và thẻ sự kiện của người đang có lượt mở ở dialog trung tâm sau khi đi xong. Escape không bỏ qua quyết định. Nợ có danh sách tài sản để mở dialog quản lý phía trên; giải quyết xong tự đóng quyết định. Không sao chép logic/bộ nút sidebar: dùng Teleport chuyển cùng panel sang dialog.

## Tích hợp Poorup

Tích hợp trực tiếp các module MIT từ [Poorup](https://github.com/jeremy341/Poorup), ghim commit `f7e5b8209dcac9c4aa7b61a96164c53545805c3e`. Đây là tích hợp module, không nhúng cả website hay thay toàn bộ engine HACHITU. Chi tiết nguồn và giấy phép: `vendor/poorup/README.md`, `vendor/poorup/LICENSE`.

- Backend gọi thật `propertyRules.js` qua `poorup-adapter.mjs` cho xây/bán/thế chấp/chuộc. Bảng tiền thuê Classic và chuyển giao đất thế chấp vẫn theo luật HACHITU đã công bố.
- `gamePresentation.js` ghi xúc xắc, từng chặng đi và thay đổi tiền bằng kết quả server. Bao gồm qua Khởi hành, lùi ba ô, đi theo thẻ, vào tù.
- Frontend dùng `clientBoardMotion.js` cùng chính sách timing upstream, nội suy giữa các bước bằng VueUse RAF. Xúc xắc tung trước, nhân vật đi sau. Server chặn lệnh tiếp trong thời gian presentation để không vượt lượt. Refresh dùng elapsed trên đồng hồ server để tiếp tục đúng chặng.
- Tên tác giả/license giữ nguyên trong vendor. Không chạy bootstrap Poorup hoặc các module tài khoản, AI, thị trường, casino và persistence.

Phần thành phố giữa bàn dùng SVG gốc của Poorup, có 3 cảnh chọn được và icon riêng cho thẻ/nhà tù. Nhân vật vẫn dùng `2d_chars`. Không thêm engine đồ họa/phụ thuộc runtime mới.

## Nhân vật 2D

Nhập tên, random hoặc chỉnh tóc/màu da/biểu cảm/áo/quần/giày/phụ kiện trước khi tạo hoặc vào phòng. Xem xoay 8 hướng và thử đi bộ trong bộ chọn. Có thể chỉnh lại tại phòng chờ; lưu thay đổi hủy sẵn sàng. Server kiểm tra đầy đủ 10 trường cấu hình và từ chối ngoại hình trùng trong phòng, kể cả khác màu tóc khi trọc hoặc màu phụ kiện không có tác dụng. Random tại phòng chờ loại các cấu hình đang có. Không upload ảnh, không gọi API bên ngoài.

Cùng một cấu hình được dùng để vẽ nhân vật toàn thân trong phòng chờ, danh sách người chơi và quân trên bàn cờ; giữ nguyên khi resume hoặc rematch. Nhân vật trên bàn di chuyển theo chặng do Poorup recorder ghi; thử đi bộ dùng RAF, tạm dừng khi trang ẩn. Người chủ động bấm thử đi bộ vẫn được xem chuyển động khi hệ điều hành bật reduced motion; hiệu ứng tự động trên bàn tôn trọng lựa chọn đó.

Renderer [2d_chars](https://github.com/juanpe500/2d_chars), MIT, được ghim commit và đóng gói tại `public/co-ty-phu/vendor/`; có LICENSE và ghi rõ chỉnh sửa wrapper. Chỉ nạp một lần trong SPA, chỉ nhân vật đang đi hoặc bản thử đi bộ vẽ lại tối đa 30fps; nội suy vị trí theo RAF, tự dọn khi unmount. Nút Hiệu ứng lưu lựa chọn trên thiết bị, mặc định theo reduced motion của hệ điều hành; người chơi có thể chủ động bật đầy đủ. Cấu hình/validation dùng chung giữa frontend và backend tại `character-config.mjs`.

App độc lập tại `/co-ty-phu`, 2–6 người, chủ phòng cũng chơi. Bản đồ 40 ô mang tên địa danh Việt Nam, 28 tài sản; hình ảnh bàn cờ và kiến trúc tạo bằng CSS, Iconify, không sao chép hình ảnh/bộ nhận diện thương mại. Không cần tài khoản, không database.

## Luật và nguồn tham khảo

- [Hasbro: Monopoly Classic](https://instructions.hasbro.com/en-my/instruction/monopoly-classic-game): cấu trúc bộ cờ, nhà/khách sạn, hai xúc xắc.
- [Hasbro/Parker Brothers rulebook](https://www.hasbro.com/common/instruct/monins.pdf): luồng mua, đấu giá, tiền thuê, xây đều, thế chấp, tù và phá sản. Đây là bản luật cũ; không coi mọi biến thể là luật duy nhất.
- [Poorup](https://github.com/jeremy341/Poorup), MIT: tham khảo kiến trúc server quyết định trạng thái, phòng và khôi phục kết nối. Không copy source hoặc tài sản hình ảnh.
- [Techopoly](https://github.com/dragonbone81/techopoly): khảo sát cách chia frontend/backend multiplayer; không nhập mã hoặc phụ thuộc từ repo.

Trước khi tạo app đã kiểm tra thư mục `src/views` cả hai dự án, danh sách `main/src/views` và PR đang mở của J2TEAM; không thấy app Cờ tỷ phú trùng ở các nguồn đã xem.

## Luật đã triển khai

- Vốn mặc định 1.500. Qua Khởi hành nhận 200; không nhân đôi khi đứng đúng ô nếu chưa bật luật nhà.
- Mua đất hoặc đấu giá bắt buộc. Mọi người, kể cả người từ chối mua, có thể đấu giá; giá thấp nhất 1.
- Đất đủ màu nhân đôi tiền thuê trống; 1–4 nhà rồi khách sạn. Ga tính số ga sở hữu; tiện ích tính tổng xúc xắc. Đất thế chấp không thu tiền, đất cùng nhóm vẫn hưởng độc quyền.
- Xây/bán đều, không xây nếu nhóm có thế chấp. Kho 32 nhà/12 khách sạn. Khách sạn trả lại 4 nhà cho kho. Bán lại công trình nửa giá. Nếu không đủ nhà để hạ khách sạn, có thể thanh lý toàn bộ công trình nhóm.
- Ba đôi liên tiếp vào tù; ra tù bằng đôi không thêm lượt. Lần thử thứ ba phải trả 50 rồi đi bằng xúc xắc vừa gieo. Nếu thiếu tiền, xử lý nợ xong mới đi.
- 16 thẻ Cơ hội + 16 Cộng đồng, trộn phía server; giấy miễn tù rời chồng bài đến khi dùng. Thẻ tiện ích gần nhất gieo xúc xắc riêng; ga gần nhất thuê gấp đôi. Không phát thứ tự chồng bài cho client.
- Thiếu tiền chuyển sang pha nợ: bán công trình, thế chấp, thương lượng hoặc phá sản. Ngân hàng không thu vượt số tiền người chơi có. Nợ người khác chuyển tài sản sau thanh lý công trình; nợ ngân hàng trả đất về và đấu giá từng lô.
- Trao đổi đất + tiền hai chiều; kiểm tra lại sở hữu/số dư tại lúc đồng ý. Không chuyển nhóm có công trình. Người nhận đất thế chấp trả ngay lãi 10% số tiền thế chấp, chuộc sau trả gốc + 10% lần nữa.
- Người cuối còn khả năng thanh toán thắng. Chế độ có thời lượng tính tổng tài sản ở cuối lượt sau khi hết giờ; hòa thì đồng thắng.

## Quy ước phiên bản số (hiển thị cả trong app)

- Bốc thăm người đi trước. Đấu giá theo lượt; rút khỏi phiên thì không quay lại phiên đó.
- Chỉ quản lý tài sản/đề nghị trao đổi trong lượt của mình hoặc khi cần trả nợ. Không có cạnh tranh mua công trình đồng thời; hết kho thì chờ.
- Tiền thuê tự động thu. Thuế thu nhập cố định 200, thuế xa xỉ 100.
- Chưa hỗ trợ chuyển giấy miễn tù cho người khác. Không vay/nợ tự do giữa người chơi.
- Có thể tự nguyện bỏ cuộc trước gieo hoặc lúc kết thúc lượt; khi đang thiếu tiền có thể tuyên bố phá sản sau khi cân nhắc tài sản.
- Tùy chỉnh vốn 1.000/1.500/2.000/2.500; ván 30/60/90 phút hoặc không giới hạn; thưởng Công viên (gom thuế, phí thẻ sự kiện, phí ra tù và lãi nhận đất từ người phá sản; không gồm tiền mua/xây/chuộc/trao đổi) và thưởng đúng Khởi hành. Hai thưởng mặc định tắt, ghi rõ là luật nhà.
- Không có thời gian ép lượt. Mất kết nối tạm dừng cả ván, thời gian tạm dừng không tính vào giới hạn ván. Người rời phải mở lại cùng trình duyệt, cùng origin. Chủ phòng có thể đóng buổi chơi bằng xác nhận hai bước.

## Cấu trúc để mở rộng

### Màn chơi phối cảnh

Bàn cờ dùng phối cảnh CSS 2.5D góc nghiêng nhẹ, giữ nguyên 40 ô và tọa độ di chuyển hiện có. `BoardGarden.vue` là cảnh SVG tự vẽ (công viên, đài phun nước, cây), không trích xuất đồ họa Business Tour. Các chủ đề thay đổi sắc cảnh; nhà cấp 1–4 và khách sạn vẫn lấy trực tiếp từ trạng thái server. Bảng tài sản, người chơi, lịch sử và hiển thị nằm sau các nút trên thanh công cụ. Không thay đổi luật để mô phỏng Business Tour; đây là hướng trình bày riêng cho HACHI CAPITAL.

- `server/property-game/board.mjs`: dữ liệu tài sản, giá thuê và hiệu ứng thẻ.
- `server/property-game/engine.mjs`: luật thuần, command transaction, RNG mặc định từ `node:crypto`; nhận RNG kiểm thử.
- `server/property-game/socket.mjs`: namespace `/property-game`, mã phòng, session bí mật, reconnect, TTL 24h, giới hạn thao tác.
- `components/GameBoard.vue`: bàn cờ, không quyết định luật.
- `composables/usePropertyRoom.ts`: kết nối và phiên thiết bị.
- `types.ts`, `styles.css`, `index.vue`: giao diện/chuyển trạng thái.

Muốn thêm thẻ: thêm cấu hình hiệu ứng vào `CARDS`, bổ sung trình xử lý + test nếu là hiệu ứng mới. Muốn thêm bản đồ khác: tách kích thước/vị trí GO/tù khỏi các hằng 40/10 hiện tại trước; bản đầu chỉ hỗ trợ chuẩn 40 ô. Muốn thêm luật: cấu hình phải được server kiểm tra, UI chỉ gửi ý định. Không nhận số xúc xắc/số dư từ client.

## Vận hành và kiểm thử

`pnpm dev` chạy frontend và server. `pnpm test:property-game` chạy unit luật và Socket.IO thật; gồm 100 ván seed tái lập, xác minh tiền không âm, kho công trình, quyền lượt, lệnh trùng, nợ và kết nối lại. `pnpm test:unit --run`, `pnpm build`, `pnpm lint:ci` kiểm tra frontend.

Rà soát 23/10/2026: bổ sung kiểm tra tất cả 32 thẻ sự kiện, 28 mức chuộc tài sản và trường hợp chủ nợ phá sản vì lãi nhận thế chấp. Sửa lỗi sai số `ceil(price * 0.55)` có thể thu thừa 1; tính tiền chuộc bằng gốc thế chấp cộng lãi làm tròn riêng. Kiểm thử trình duyệt hai origin: sẵn sàng, bắt đầu, gieo, trao đổi, chuyển lượt, reload khôi phục, bảng giá và zoom mobile. Bàn có danh sách chọn ô để điện thoại nhỏ không phải chạm chính xác vào ô quá nhỏ.

Phòng nằm trong RAM và mất khi backend restart; localStorage chỉ chứa vé khôi phục, không chứa toàn bộ ván. Chạy đúng một process backend vì chưa có adapter nhiều máy. `/socket.io/` dùng proxy nginx hiện có. Phải restart riêng HACHITU khi cập nhật engine. Không ghi secret phiên vào log, không trả secret trong state công khai.

Giới hạn kiểm chứng: test tự động và trình duyệt mô phỏng không chứng minh không còn lỗi trên mọi thiết bị hoặc mọi chuỗi giao dịch vô hạn. Các quy ước khác luật bàn truyền thống ở trên được công bố để cả bàn thống nhất trước ván.
