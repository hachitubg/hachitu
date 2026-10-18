# Ma Sói · Bộ bài điện tử có quản trò

Bản mới thay thế luồng quản trò tự động/offline cũ. Một quản trò thật điều khiển trò chơi; quản trò không được tính vào số người chơi và không nhận bài. Từ 5 đến 24 người chơi trên các thiết bị riêng.

## Luồng chơi

Khi tạo phòng, quản trò có thể bật **Chỉ dùng bộ bài**. Cấu hình giữ nguyên cho cả buổi chơi. Chế độ này cho chọn cả 67 loại nhân vật (trừ lá phụ trợ), chỉ kiểm tra số lá/bản sao; không áp đặt phe, cặp vai hoặc lá ẩn Kẻ say rượu. Sau đếm ngược và mọi người xác nhận xem bài, app dừng ở màn hình ván đang diễn ra. Mỗi người chỉ biết bài mình; quản trò xem được tất cả. Không tự gọi đêm, dùng kỹ năng, vote, gây chết hoặc tính thắng. Quản trò bấm Kết thúc ván để công khai bài, hoặc Chuẩn bị ván mới để về phòng chờ và chia lại sau khi mọi người sẵn sàng. Các ván này lưu danh sách bài nhưng không tự cộng thắng/thua. Mất kết nối không khóa điều hành ván trong chế độ này; người chơi vẫn khôi phục được phiên cũ.

1. Quản trò tạo phòng. Người chơi quét QR hoặc nhập mã 6 ký tự, đặt tên, chọn avatar có sẵn hoặc ảnh cá nhân, rồi bấm Sẵn sàng.
2. Quản trò gợi ý bộ bài dựa trên điểm trong JSON, số Sói và giới hạn số lá vật lý; vẫn có thể chỉnh từng lá. Điểm là tham khảo, không bảo đảm cân bằng tuyệt đối.
3. Chốt bộ bài và đếm ngược 5 giây trên server. Mỗi máy chỉ nhận lá của chính mình. Chạm hoặc vuốt để lật/úp bài; xác nhận đã xem.
4. Sau khi tất cả đã xem, quản trò thấy danh sách vai và mở đêm đầu tiên.
5. Server chọn thứ tự gọi các vai có trong ván. Người có lượt chọn và xác nhận trên máy mình; quản trò thấy lựa chọn trực tiếp. Không tự hết hạn hay random hành động.
6. Sói thấy đề xuất của đồng đội. Chỉ xác nhận khi cả đàn thống nhất; một khi có Sói xác nhận, các Sói khác không đổi sang mục tiêu khác. Quản trò chỉ chuyển lượt khi đủ xác nhận.
7. Quản trò gọi cả làng thức dậy; server đếm 10 giây rồi công bố kết quả. Người bị loại không được vote/xem lịch sử bí mật; riêng Thợ săn/Hồn ma được mở thao tác khi tới lượt kỹ năng sau khi chết.
8. Thảo luận trực tiếp → vote người giải thích → người đó giải thích → vote Có/Không treo cổ. Quản trò chốt từng bước sau khi đủ phiếu.
9. Đề cử hòa: vote lại một lần giữa các người hòa; tiếp tục hòa hoặc toàn phiếu trắng: không treo. Vote treo cổ cần hơn nửa tổng trọng số phiếu Có.
10. Kết thúc: mọi máy xem thắng/thua, vai và toàn bộ lịch sử. Quản trò mở ván tiếp theo; bộ bài và thành tích buổi được giữ, người chơi sẵn sàng lại.

## Chọn bộ bài, nhật ký và thành tích

- Icon thư viện trên thanh đầu mở 67 loại nhân vật, không hiển thị Quản trò/Thẻ trống. Tìm theo tên Việt/Anh, hỗ trợ không dấu, kết hợp lọc phe. Danh sách dọc có ảnh, mô tả và điểm cân bằng từng lá; điểm chưa xác định ghi Không cố định. Tất cả nhân vật có ảnh riêng; các vai chưa có logic được làm mờ, ghi rõ chưa mở và không được chia bài.

- Trình chỉnh bộ bài chỉ hiển thị đúng các lá đang chọn, mỗi bản sao là một ô. Quản trò bấm vào thẻ để đổi lá; chọn xong trở về bộ bài. Mô tả chức năng mặc định thu gọn, bấm để mở. Việc thay lá luôn giữ nguyên số ô và kiểm tra giới hạn số bản sao (không tính lá đang được thay).
- Trong phòng chờ, mọi người được xem bộ bài quản trò đã lưu qua nút Xem bộ bài; cập nhật khi quản trò chốt thay đổi. Người chơi chỉ xem thẻ và mở chức năng, không có nút gợi ý/chốt/thay lá; server vẫn chặn lệnh chỉnh bài từ người chơi. Không công khai lá ẩn của Kẻ say rượu hoặc lá đã chia cho từng người.
- Mục **Nhật ký từng đêm** dành riêng cho quản trò, có trong thanh đầu và màn hình điều hành. Nhật ký nhóm hành động đã xác nhận và kết quả bình minh theo đêm, cập nhật trực tiếp. Người chơi không nhận log bí mật trước khi kết thúc ván.
- Nhật ký kể trực tiếp theo vai và tên: “Sói (Tú) cắn Lệ Emm”, “Bảo vệ (An) bảo vệ Hải”, “Phù thủy (Mai) dùng bình độc lên Tú”. Nhiều Sói được gom thành một câu khi tất cả đã chốt cùng mục tiêu; kết quả soi giữ đúng mức thông tin của từng vai, không biến “không phải Sói” thành khẳng định Dân thường. Bình minh nêu rõ ai chết, ai được bảo vệ hoặc ban phước cứu.
- **Lịch sử các ván** và **Bảng thành tích** là hai màn hình riêng. Lịch sử chỉ hiển thị vai, kết quả và diễn biến của ván được chọn. Thành tích cộng thắng/thua của cả buổi, giữ cả người đã rời phòng và bỏ qua ván hủy.

## Avatar DiceBear

- Thay avatar thẻ bài bằng DiceBear HTTP API `10.x`: Adventurer, Bottts, Lorelei, Pixel Art, Fun Emoji. Có chọn phong cách, bộ mẫu, nút Ngẫu nhiên và ảnh tải từ máy.
- API không yêu cầu key; public API miễn phí cho mục đích phi thương mại, có giới hạn tốc độ và không bảo đảm uptime. Đây là dự án cá nhân. Nếu chuyển sang dịch vụ thương mại cần xem lại điều khoản hoặc self-host.
- Chỉ gửi seed ngẫu nhiên UUID tới API, không dùng tên, mã phòng hay token phiên làm seed. Server chỉ chấp nhận descriptor theo danh sách phong cách cho phép, không chấp nhận URL tùy ý. Không cho hai thành viên dùng lại cùng descriptor trong phòng; các seed khác nhau vẫn có thể tạo diện mạo tương tự vì số tổ hợp của mỗi phong cách hữu hạn.
- Avatar hiển thị qua thẻ img, không chèn SVG trực tiếp vào HTML; dùng referrerpolicy no-referrer. Khi tải ảnh lỗi, hiển thị chữ viết tắt hoặc icon thay thế. Ảnh cá nhân vẫn xử lý như trước, không gửi sang DiceBear.
- Nguồn: https://www.dicebear.com/integrations/http-api/ và https://www.dicebear.com/licenses/.
- Adventurer: Lisa Wischofsky, CC BY 4.0; Fun Emoji: Davis Uche, CC BY 4.0; Lorelei: Lisa Wischofsky, CC0; Pixel Art: DiceBear, CC0; Bottts: Pablo Stanley, free for personal and commercial use. Các ảnh được hiển thị qua API của DiceBear; liên kết tác giả/giấy phép có ngay trong bộ chọn avatar.

## Danh mục vai

Nguồn dữ liệu nguyên bản: `public/werewolf-host/deck.json`, do chủ dự án cung cấp. Bộ 93 lá gồm 89 lá chia được, 1 Quản trò và 3 Thẻ trống. Có 67 loại vai chơi, không phải 93 vai khác nhau.

Hiện mở **toàn bộ 34 vai chơi của bộ Cơ bản**, có hình riêng và hướng dẫn luật. Giữ thêm 4 vai mở rộng đã có: Sói giả dân, Thám tử Mentalist, Tiên tri bí ẩn và Nữ thợ săn. Tổng cộng 38 vai có thể chọn. Lá Quản trò và Thẻ trống là phụ trợ, không chia cho người chơi.

Các vai mở rộng khác vẫn tạm hoãn. `server/werewolf/basic-guides.mjs` ghi các biến thể áp dụng; `guide_vi` hiện ngay trong giao diện thẻ và lượt chơi. JSON gốc được giữ nguyên để đối chiếu. Bộ gợi ý ưu tiên vai cơ bản; quản trò có thể cấu hình tất cả 34 vai.

Các quy ước của bản này:

- Bảo vệ được tự bảo vệ, không cùng mục tiêu hai đêm liên tiếp; chặn một đêm bị tấn công, kể cả độc/Nữ thợ săn theo mô tả JSON.
- Phù thủy có thể dùng hai bình cùng đêm, mỗi bình một lần; chỉ biết nạn nhân Sói khi còn bình cứu.
- Tu sĩ ban phước một người khác; phước tồn tại đến khi chặn một lần chết ban đêm, không chặn treo cổ.
- Tiên tri thường chỉ trả Sói/Không phải Sói, bị Người lai Sói và Sói giả dân đánh lừa; Tiên tri bí ẩn mới biết tên vai.
- Thị trưởng có trọng số 2 ở cả đề cử và phán quyết. Người yêu hòa bình phải chọn Không, Dân ngốc phải chọn Có ở vòng treo cổ.
- Hoàng tử được miễn lần treo đầu và công khai vai. Pháp sư câm không lặp mục tiêu suốt ván; người bị câm vẫn vote.
- Hội Tam điểm phải đủ 2 lá. Tiên tri Sói chỉ thêm khi có Tiên tri thường.
- Dân thắng khi không còn Sói thật, Ma cà rồng hay mối nguy từ lá ẩn chưa tỉnh của Kẻ say rượu. Sói thắng theo số lượng khi còn Sói thường/Sói con/Sói giả dân và không còn Ma cà rồng. Ma cà rồng thắng khi mọi người sống đều thuộc phe này.

### Các vai cơ bản bổ sung

| Vai              | Cách xử lý                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiên tri tập sự  | Gọi từ đêm sau khi Tiên tri chết, khi không còn Tiên tri sống.                                                                                                            |
| Thần tình yêu    | Chọn hai người đêm đầu, được chọn mình. Chỉ biết tên nhau. Chết theo nhau; khác phe thắng khi là hai người sống cuối.                                                     |
| Kẻ bị nguyền rủa | Sói cắn không được cứu/bảo vệ thì thành Sói, săn từ đêm sau.                                                                                                              |
| Con bệnh         | Chết trực tiếp do Sói cắn khiến đàn nghỉ săn đêm sau; ưu tiên hơn thưởng của Sói con, không dồn lượt.                                                                     |
| Người nhân bản   | Nhận vai, phe và kỹ năng còn lại của mục tiêu khi họ chết; không nhận tình yêu/vết thương/bảo hộ cá nhân. Nhận Hồn ma thì cũng chết.                                      |
| Kẻ say rượu      | Quản trò chọn lá ẩn còn dư, không dùng vai cần lựa chọn đêm đầu. Tính phe theo lá ẩn nhưng chưa dùng quyền năng và bị soi như Dân trong hai đêm đầu. Nhận vai đầu đêm ba. |
| Hồn ma           | Chết cuối đêm một. Từ đêm hai gửi một chữ hoặc bỏ qua; không dùng chữ đầu của mọi từ trong tên người chơi. Công bố chữ lúc bình minh.                                     |
| Thợ săn          | Mọi nguyên nhân chết mở lượt bắn/bỏ qua. Xử lý cả chuỗi phát bắn trước khi kiểm tra thắng; bảo vệ không chặn phát bắn.                                                    |
| Sói đơn độc      | Săn cùng đàn nhưng thắng riêng khi sống cuối hoặc còn đúng một người không thuộc phe Sói.                                                                                 |
| Bà già           | Mục tiêu không nói, vote hoặc bị đề cử trong ngày sau; vẫn sống và tính vào phe. Hết tác dụng đầu đêm sau.                                                                |
| P.I.             | Dùng vòng ngồi do quản trò sắp. Một lần xét người được chọn và hai người sống gần nhất; xét Sói thật, không bị Người lai Sói/Sói giả dân đánh lừa.                        |
| Chán đời         | Chết thì thắng riêng cuối ván, không kết thúc ván ngay khi chết.                                                                                                          |
| Lực sĩ           | Vết cắn không bị chặn gây vết thương; chết cuối đêm kế tiếp, không cứu được vết thương cũ.                                                                                |
| Ma cà rồng       | Thống nhất mục tiêu; miễn nhiễm Sói cắn. Vết cắn được kiểm tra bảo hộ ban đêm; nạn nhân chết sau phiên vote kế tiếp, kể cả không treo ai.                                 |
| Sói con          | Chết cho đàn hai mục tiêu khác nhau ở đêm sau; cả đàn được chọn hy sinh. Phù thủy chọn rõ một nạn nhân để cứu.                                                            |
| Du côn           | Chọn hai người khác mình đêm đầu. Sống cuối ván và cả hai mục tiêu chết thì đồng thắng.                                                                                   |
| Trưởng giáo phái | Thu nạp mỗi đêm, không báo cho mục tiêu. Cuối ván mọi người sống là tín đồ thì đồng thắng, không cần trưởng giáo còn sống.                                                |
| Kẻ phá rối       | Một lần kích hoạt hai phiên đề cử–giải thích–treo cổ ngày sau; Hoàng tử được miễn treo vẫn kết thúc ngày ngay.                                                            |

Thắng riêng được tính từng người qua `myWon` và lịch sử `won`; không suy từ nhãn phe thắng chung. Cặp đôi khác phe ưu tiên thắng cặp đôi. Khi không ai sống, không phe chính nào thắng nhưng vẫn xét mục tiêu cá nhân. Lịch sử lưu vai ban đầu và vai cuối.

Thứ tự bình minh: vết thương Lực sĩ cũ → Sói → độc → Nữ thợ săn → vết cắn Ma cà rồng → Hồn ma đêm đầu. Mỗi cái chết xử lý kế thừa và cặp đôi; xử lý Thợ săn trước khi chuyển pha hoặc kết thúc ván.

## Dữ liệu và kết nối

### Làm lại đêm gần nhất

- Với chế độ có logic, trước mỗi đêm server lưu một bản chụp trong RAM. Chỉ giữ đêm gần nhất, không lưu chuỗi bản chụp hay database.
- Nút **Làm lại đêm N** chỉ dành cho quản trò; có hộp xác nhận. Đưa ván về đầu đêm N kể cả đang bình minh, vote hoặc vừa kết thúc ván. Những diễn biến từ đêm này trở đi được hoàn tác: người sống/chết, vai chuyển đổi, tài nguyên kỹ năng, hiệu ứng, lượt, phiếu, ghi chú riêng, nhật ký và kết quả/thành tích của ván nếu đã chốt. Các ván trước giữ nguyên.
- Giữ danh tính/token và trạng thái kết nối hiện tại; lệnh từ revision cũ bị từ chối. Người được hồi phục nhưng đang mất kết nối vẫn khiến ván tạm dừng chờ quay lại.
- Không được khôi phục nếu thành viên đã rời phòng sau kết thúc; chuẩn bị ván mới sẽ xóa bản chụp. Không có nút này trong chế độ chỉ dùng bộ bài.
- Không thể thu hồi thông tin mà người chơi đã đọc hoặc nghe. Cả bàn cần thống nhất có thể tiếp tục công bằng hay nên chia ván mới.

- `server/werewolf/engine.mjs`: luật, đề xuất bộ bài, xác nhận hành động, phân quyền view, kết quả và lịch sử.
- `server/werewolf/socket.mjs`: namespace Socket.IO `/werewolf`, dùng transport `/socket.io`, room registry riêng.
- `src/views/werewolf-host/composables/useRoom.ts`: kết nối và khôi phục phiên. Lưu token buổi chơi bằng VueUse localStorage; token không được broadcast.
- Chỉ server giữ bộ bài đã chia. Client không gửi snapshot luật/kết quả. Command kèm revision để chặn lặp hành động từ giai đoạn cũ.
- Role và thông tin riêng chỉ gửi đúng chủ; quản trò xem sau khi mọi người xác nhận nhận bài. Các client khác không nhận lựa chọn đêm trừ đồng đội Sói/Ma cà rồng cùng lượt. Lịch sử bí mật chỉ mở cho người chơi cuối ván.
- Ảnh avatar cá nhân được crop 128×128 và nén trên máy trước khi gửi; server chỉ giữ trong RAM, không ghi ảnh xuống đĩa. Avatar DiceBear chỉ lưu mã phong cách và seed.
- Mất kết nối của quản trò/người còn sống tạm dừng chuyển lượt; mở lại cùng trình duyệt để tiếp tục. Deadline đếm ngược được lùi theo thời gian pause.
- Phòng chờ cho quản trò xóa người bỏ dở. Người mới vào không hủy Sẵn sàng của người cũ, nhưng bộ bài cần gợi ý/chốt lại khi thay số người.
- Quản trò thấy tên người chưa xác nhận ở lượt đêm/nhận bài/vote; người chơi khác không nhận danh sách bí mật này.
- Nếu người bỏ dở không thể quay lại, quản trò có thể Hủy ván trong mục Người chơi, xác nhận lần nữa rồi mở ván mới. Ván hủy được ghi trong lịch sử nhưng không cộng thắng/thua; dùng được cả khi ván đang pause.
- Khi pause, đồng hồ hiển thị đứng yên. Lỗi kết nối tạm thời không xóa token đã lưu; nút Kết nối lại thử khôi phục danh tính cũ.
- Không database. Phòng, avatar, hành động, lịch sử và thắng/thua giữ trong RAM tối đa 24 giờ từ lúc tạo; mất khi server restart hoặc quản trò đóng buổi chơi.
- Các game trong cùng phòng dùng cùng player ID để cộng thành tích. Rời phòng rồi vào bằng danh tính mới sẽ không kế thừa thành tích cũ.

## Thử và triển khai

Bảng rà soát từng vai, các lỗi đã sửa và quy ước luật dễ nhầm được ghi trong [ROLE_LOGIC_REVIEW.md](./ROLE_LOGIC_REVIEW.md).

```sh
pnpm dev
pnpm test:werewolf
pnpm build
pnpm lint:ci
```

Mở `/werewolf-host`. Thử nhiều người bằng các thiết bị hoặc profile trình duyệt khác nhau. Cùng profile sẽ khôi phục cùng danh tính, không tạo nhiều người mới.

QR luôn dùng origin đang mở trang. QR localhost chỉ dùng trên máy đó; để bạn bè thử LAN, chạy Vite với `--host` rồi truy cập IP LAN bằng điện thoại cùng mạng. Production dùng HTTPS.

Triển khai bản này cần build frontend **và restart riêng backend HACHITU** để nạp module mới. Restart làm mất các phòng đang lưu RAM của backend, nên chọn lúc không có ván/phòng đang dùng. Không thay đổi cấu hình hay tiến trình của các website khác.

## Minh họa và thư viện

Ba ảnh `public/werewolf-host/roles.webp`, `public/werewolf-host/basic-extra.webp` và `public/werewolf-host/expansion.webp` được tạo bằng công cụ imagegen tích hợp, không dùng ảnh trích từ bộ bài thương mại. Toàn bộ 67 loại nhân vật có chân dung riêng theo phong cách hoạt hình cổ tích vẽ tay. Prompt và bố cục atlas được lưu trong `public/werewolf-host/ART.md`.

QR dùng [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT), vendored tại `public/werewolf-host/vendor/`, tải lười bằng VueUse `useScriptTag`. Không gửi mã phòng tới dịch vụ tạo QR bên ngoài. Có file LICENSE kèm theo; vendor được loại riêng khỏi oxlint, code ứng dụng vẫn được lint bình thường.
