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

### Chọn người chơi trên điện thoại

- Lượt kỹ năng và vòng đề cử dùng chung danh sách avatar + tên + số chỗ. Từ 8 người có tìm tên không dấu; danh sách có vùng cuộn giới hạn, không cần chờ ảnh tải xong để chọn.
- Chọn được phản hồi ngay trên máy. Lựa chọn nháp được gộp trong 100 ms và gửi tuần tự; không bật khóa toàn trang trong khi chờ ACK. Bấm xác nhận sẽ gửi xong lựa chọn cuối rồi mới chốt; lệnh của lượt cũ bị bỏ qua khi đổi pha/mất kết nối.
- Không có hiệu ứng phóng/nhảy từng ô, avatar giữ nguyên DOM khi đổi trạng thái chọn. Nút xác nhận có vùng dính đáy và safe area. Khi đang chọn, lá riêng mở trong popup để dành diện tích cho mục tiêu.
- Fixture 24 người để kiểm tra mobile trên Vite: `/src/views/werewolf-host/__tests__/fixtures/target-picker.html`. Chỉ dùng xem thử component khi chạy `pnpm dev`, không phải một app/route production.

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

Hiện mở **toàn bộ 34 vai chơi của bộ Cơ bản**, có hình riêng và hướng dẫn luật. Thêm 16 vai mở rộng: Sói giả dân, Thám tử Mentalist, Tiên tri bí ẩn, Nữ thợ săn, Sói trùm, Sói đau khổ, Sói ăn chay, Sói răng thỏ (Nanh Sói), Người khám phá, Kẻ tử đạo, Bloody Mary, Yêu tinh, Người chứng kiến, Sói chiêm bao, Sói tuổi teen và Xác ướp. Tổng cộng 50 vai có logic tự động; 17 vai còn lại chỉ chia được trong chế độ bộ bài. Lá Quản trò và Thẻ trống là phụ trợ, không chia cho người chơi.

### Bảy vai mở rộng tiếp theo

Các luật gốc lấy từ JSON chủ dự án cung cấp; các điểm chưa nêu đủ được chốt thành quy ước hiển thị qua `guide_vi`:

| Vai              | Luồng và tương tác                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kẻ tử đạo        | Có lượt riêng sau quyết định treo cổ và trước cái chết. Chọn hy sinh hoặc bỏ qua, quản trò chốt khi đủ xác nhận. Không cứu chính mình; Hoàng tử dùng miễn treo trước. Nhiều người tình nguyện thì chỉ người đầu theo vòng ngồi hy sinh. Chết thay vẫn kích hoạt tình yêu/liên kết, Ma cà rồng và Thợ săn theo luật thường.                                                                                                                                                 |
| Bloody Mary      | Khi sống thuộc Dân. Ghi phe nguyên nhân chết: Sói cắn/vết thương cũ là Sói, vết cắn Ma cà rồng là Ma cà rồng, treo cổ/kỹ năng Dân/hình phạt là Dân. Chết dây chuyền giữ phe nguyên nhân gốc. Từ đêm sau, người đã chết được chọn một mục tiêu bất kỳ/bỏ qua, không lộ trước phe mục tiêu. Chỉ đúng phe báo thù mới tấn công; Sói gồm cả Sói thật và tay sai. Bảo hộ có thể chặn. Cuối ván nếu chết thì thắng khi phe gây chết không phải phe thắng chính và ván không hòa. |
| Yêu tinh         | Lượt sau đàn Sói và trước Phù thủy. Xem danh sách vết cắn, chọn một vết cắn để chuyển sang hàng xóm sống hoặc giữ nguyên. Cho chuyển sang Sói/mình; cấm dồn hai vết cắn lên cùng người. Kiểm tra cứu/bảo vệ/khả năng phản ứng trên người nhận mới. Nhiều Yêu tinh thao tác lần lượt theo vòng ngồi.                                                                                                                                                                        |
| Người chứng kiến | Lượt xác nhận thông tin đêm đầu: chỉ biết Tiên tri thường đang có, không lộ ngược danh tính. Cần Tiên tri thường trong bộ bài hoặc lá ẩn Kẻ say rượu. Trường hợp lá ẩn chỉ báo chưa xuất hiện. Người nhân bản kế thừa thì được báo các Tiên tri thường đang sống.                                                                                                                                                                                                          |
| Sói chiêm bao    | Không có lượt săn khi chưa có Sói thật khác chết, kể cả chỉ có mình trong đàn. Tay sai chết không kích hoạt. Các Sói thức biết tên Sói chiêm bao đêm đầu, Sói chiêm bao chưa được biết đồng đội. Sau khi có Sói thật chết, tham gia từ đêm sau. Vẫn bị soi là Sói và tính vào phe khi ngủ.                                                                                                                                                                                 |
| Sói tuổi teen    | Quản trò xác nhận riêng ở cuối ngày trước đêm tiếp theo: đã nói từ “Sói”/“Ma sói” hay chưa. Không có giá trị mặc định, phải chọn cho từng người rồi chốt. Chưa nói thì chết; xử lý hết chết dây chuyền trước khi kiểm tra thắng. Bị câm/Bà già cấm nói thì miễn ngày đó. Không xử phạt nếu ván đã kết thúc trước hạn kiểm tra. Không tự nhận diện âm thanh.                                                                                                                |
| Xác ướp          | Chọn một người khác mỗi đêm. Người bị tác động vẫn gửi phiếu để tránh kẹt lượt, nhưng khi chốt cả đề cử/vote lại/treo cổ/phiên phụ đều dùng phiếu Xác ướp, giữ trọng số người bị tác động. Xác ướp chết hoặc bị cấm vote thì dùng phiếu gốc. Ghi đè phiếu bắt buộc của Dân ngốc/Yêu hòa bình. Chuỗi điều khiển đi đến cuối; vòng lặp dùng phiếu gốc mỗi người. Cùng chọn một mục tiêu: Xác ướp cuối theo vòng ngồi có hiệu lực.                                            |

Làm lại đêm khôi phục cả cờ thức tỉnh Sói chiêm bao, phe báo thù của Mary, liên kết phiếu và phần kiểm tra từ khóa. Không gửi các dữ liệu bí mật này trong roster công khai. Lịch sử quản trò ghi rõ các quyết định và phiếu thực tế.

### Người khám phá: luật một lần theo yêu cầu chủ dự án

- Mỗi đêm còn sống và chưa dùng được chọn một người khác, hoặc xác nhận bỏ qua. Cả ván chỉ một lần sử dụng, kể cả khi đoán đúng. Không cho chọn mình hoặc hai mục tiêu. Không thực hiện ngoài lượt ban đêm.
- Chốt dùng sẽ tiêu hao lượt; kết quả được xử lý vào bình minh sau độc/Nữ thợ săn. Sói thật được xét tại thời điểm chốt, gồm cả Sói giả dân và Nanh Sói ngủ. Chọn Sói thật thì tấn công mục tiêu; Bảo vệ/ban phước có thể chặn nhưng lượt vẫn mất.
- Chọn không phải Sói thật (kể cả Người lai Sói, tay sai hoặc Kẻ bị nguyền chưa chuyển vai) thì Người khám phá chết. Bảo vệ/ban phước/bình cứu không chặn hình phạt này. Giữ nguyên các tương tác chết theo liên kết và Thợ săn.
- Lượt đã chốt vẫn giải quyết nếu Người khám phá chết cùng đêm. Người nhân bản kế thừa trạng thái đã dùng/chưa dùng; làm lại đêm khôi phục tài nguyên theo bản chụp. Mỗi đêm mới xóa hành động chờ của đêm trước.
- JSON gốc vẫn giữ mô tả phiên bản ban đầu để đối chiếu. `guide_vi` ghi luật một lần đã thay đổi, được dùng trên thẻ, thư viện, chọn bộ bài và màn hình điều hành.

Các vai mở rộng khác vẫn tạm hoãn. `server/werewolf/basic-guides.mjs` ghi các biến thể áp dụng; `guide_vi` hiện ngay trong giao diện thẻ và lượt chơi. JSON gốc được giữ nguyên để đối chiếu. Bộ gợi ý ưu tiên vai cơ bản; quản trò có thể cấu hình tất cả 34 vai.

Các quy ước của bản này:

- Bảo vệ được tự bảo vệ, không cùng mục tiêu hai đêm liên tiếp; chặn một đêm bị tấn công, kể cả độc/Nữ thợ săn theo mô tả JSON.
- Phù thủy có thể dùng hai bình cùng đêm, mỗi bình một lần; chỉ biết nạn nhân Sói khi còn bình cứu.
- Tu sĩ ban phước một người khác; phước tồn tại đến khi chặn một lần chết ban đêm, không chặn treo cổ.
- Tiên tri thường chỉ trả Sói/Không phải Sói, bị Người lai Sói và Sói giả dân đánh lừa; Tiên tri bí ẩn mới biết tên vai.
- Thị trưởng có trọng số 2 ở cả đề cử và phán quyết. Người yêu hòa bình phải chọn Không, Dân ngốc phải chọn Có ở vòng treo cổ.
- Hoàng tử được miễn lần treo đầu và công khai vai. Pháp sư câm không lặp mục tiêu suốt ván; người bị câm vẫn vote.
- Hội Tam điểm phải đủ 2 lá. Tiên tri Sói chỉ thêm khi có Tiên tri thường.
- Dân thắng khi không còn Sói thật, Ma cà rồng hay mối nguy từ lá ẩn chưa tỉnh của Kẻ say rượu. Sói thắng theo số lượng khi còn Sói thật ngoài Sói đơn độc và không còn Ma cà rồng; tính cả Sói ăn chay không săn được và Nanh Sói đang ngủ. Ma cà rồng thắng khi mọi người sống đều thuộc phe này.

### Bốn Sói mở rộng

- **Sói trùm:** mỗi lượt đàn chọn một người hoặc hai người kề nhau trong vòng sống; bỏ qua chỗ chết và nối đầu/cuối vòng. Phải thống nhất cả tập mục tiêu. Thưởng Sói con bắt buộc hai mục tiêu bất kỳ, không cộng thành ba. Con bệnh ưu tiên chặn lượt săn. Bình cứu chỉ cứu một nạn nhân. Đòn đã chốt vẫn có hiệu lực nếu Sói trùm chết cùng bình minh.
- **Sói đau khổ:** lượt riêng đầu đêm một, chọn một người khác, kể cả Sói theo mô tả JSON không giới hạn phe. Liên kết bí mật một chiều: mục tiêu chết khiến Sói đau khổ chết theo, không bị bảo hộ chặn; chiều ngược không xảy ra. Người nhân bản nhận cả liên kết. Các cái chết liên quan/Thợ săn xử lý xong mới chốt thắng. Reset đêm một xóa liên kết để chọn lại.
- **Sói ăn chay:** vẫn được cả đàn nhận diện và bị soi là Sói; không thể cắn nếu là Sói thật cuối cùng, kể cả còn tay sai hoặc có thưởng Sói con. Nếu còn Nanh Sói đang ngủ thì vẫn chưa phải Sói cuối, nên được săn. Có thể thắng bằng phiếu/số lượng.
- **Nanh Sói:** đêm đầu nhận tên Sói và tham gia săn theo nhịp đêm đầu của app. Từ đêm hai, chỉ có lượt nếu là Sói thật cuối cùng; lúc ngủ không nhận đề xuất hoặc quyền xác nhận của đàn. Tay sai không ngăn thức dậy. Xét trạng thái đầu mỗi đêm, không mở lượt giữa bình minh.

Nguồn triển khai chính là bốn mô tả/ghi chú trong JSON do chủ dự án cung cấp. Đã tham khảo [rulebook Ultimate Werewolf do Pegasus phát hành](https://cdn.pegasus.de/public/media/5f/1f/6e/1717757324/4250231704208_gb.pdf?ts=1752574418) cho khung điều hành, nhưng bản đó không bao gồm bốn lá Wolfpack, nên không dùng để khẳng định mọi chi tiết của phần mở rộng. Các tương tác chưa nêu trong JSON được chốt thành quy ước ở trên và trong `guide_vi`; không áp dụng luật Big Bad Wolf của game Ma Sói khác.

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

Thứ tự bình minh: vết thương Lực sĩ cũ → Sói → độc → Nữ thợ săn → Người khám phá → Bloody Mary → đánh dấu vết cắn Ma cà rồng → Hồn ma đêm đầu. Yêu tinh đã chuyển vết cắn trước đó trong lượt đêm, trước Phù thủy. Mỗi cái chết xử lý kế thừa, cặp đôi và Sói đau khổ; xử lý Thợ săn trước khi chuyển pha hoặc kết thúc ván.

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

Ma trận cặp/bộ ba, mô phỏng 5–24 người, cách chạy audit và tái hiện lỗi theo seed: [TESTING.md](./TESTING.md). `pnpm test:werewolf:matrix` được chạy trong CI; `pnpm test:werewolf:audit` là lượt đầy đủ 28.486 ván.

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

Giao diện mobile dùng popup sát đáy màn hình, hỗ trợ vùng an toàn của điện thoại. Phòng chờ dùng avatar gọn, danh sách tên dài tự xuống dòng; bộ lọc phe và các ván lịch sử cuộn ngang. Hiệu ứng lật bài vẫn giữ, còn thẻ người chơi trong phòng chờ và nền popup không chạy hiệu ứng nặng trên mobile.

Ba ảnh `public/werewolf-host/roles.webp`, `public/werewolf-host/basic-extra.webp` và `public/werewolf-host/expansion.webp` được tạo bằng công cụ imagegen tích hợp, không dùng ảnh trích từ bộ bài thương mại. Toàn bộ 67 loại nhân vật có chân dung riêng theo phong cách hoạt hình cổ tích vẽ tay. Prompt và bố cục atlas được lưu trong `public/werewolf-host/ART.md`.

QR dùng [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT), vendored tại `public/werewolf-host/vendor/`, tải lười bằng VueUse `useScriptTag`. Không gửi mã phòng tới dịch vụ tạo QR bên ngoài. Có file LICENSE kèm theo; vendor được loại riêng khỏi oxlint, code ứng dụng vẫn được lint bình thường.
