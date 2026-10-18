# Rà soát luật các lá bài

Ngày rà soát: 18/10/2026. Phạm vi: 38 vai đã mở (34 cơ bản và 4 mở rộng), engine, phân quyền Socket.IO và giao diện thao tác. Đối chiếu JSON do chủ dự án cung cấp, gồm cả ghi chú từng lá; những biến thể đã chọn được công bố bằng `guide_vi` trong ứng dụng.

## Lỗi xác nhận và đã sửa

1. Người nhân bản mất phép ban phước của chính mình khi kế thừa vai. Nguyên nhân: thay toàn bộ tài nguyên kỹ năng bằng dữ liệu của người chết rồi xóa bảo hộ. Đã giữ bảo hộ cá nhân của Người nhân bản, vẫn không sao chép bảo hộ của người chết. Kiểm thử tái hiện lỗi trước sửa và xác nhận bảo hộ chặn được vết cắn ở đêm sau.
2. Pháp sư câm bị buộc chọn người mặc dù JSON mô tả có thể chọn. Đã cho phép bỏ qua, không tiêu hao mục tiêu; vẫn cấm làm câm cùng người hai lần trong cả ván theo ghi chú JSON. Đã cập nhật hướng dẫn trên thẻ và màn hình thao tác.

## Đối chiếu từng vai

Mỗi vai bên dưới có ca chạy luồng tối đa bốn đêm cùng đề cử phiếu trắng, dừng sớm nếu kết thúc ván. Các tương tác đặc biệt có ca riêng; việc này không phải kiểm thử mọi tổ hợp của 38 vai.

| Vai                | Điểm đã rà soát                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Dân thường         | Không có lượt đêm; quyền đề cử/vote; thắng cùng Dân.                                                                         |
| Sói thường         | Mục tiêu hợp lệ, cả đàn thống nhất và khóa sau xác nhận; chỉ tính thắng sau xử lý các cái chết.                              |
| Tiên tri           | Một mục tiêu, kết quả sau xác nhận; đúng hai dạng ngụy trang.                                                                |
| Bảo vệ             | Được tự bảo vệ; không lặp hai đêm liền; chặn tấn công đêm, không chặn Thợ săn/chết theo người yêu/vết thương cũ.             |
| Phù thủy           | Mỗi bình một lần; dùng cả hai cùng đêm; cứu đúng một nạn nhân khi Sói cắn hai người; không lộ mục tiêu Sói khi hết bình cứu. |
| Hội Tam điểm       | Cần đủ hai lá; thông tin đồng đội chỉ gửi đúng người sau xác nhận.                                                           |
| Thị trưởng         | Phiếu trọng số hai; đa số tính theo tổng trọng số; vai không tự công khai.                                                   |
| Kẻ phản bội        | Biết tên Sói sau xác nhận đêm đầu; không tham gia đi săn; soi thường không phải Sói.                                         |
| Người lai Sói      | Phe Dân, soi thường ra Sói; P.I. không coi là Sói thật.                                                                      |
| Người yêu hòa bình | Đề cử bình thường; vòng treo cổ bắt buộc Không, được kiểm tra ở server.                                                      |
| Dân ngốc           | Đề cử bình thường; vòng treo cổ bắt buộc Có, được kiểm tra ở server.                                                         |
| Hoàng tử           | Miễn lần treo đầu, công khai vai, kết thúc ngày kể cả có Kẻ phá rối; lần sau chết bình thường.                               |
| Pháp sư câm        | Được bỏ qua; không lặp cùng người trong cả ván; câm không tước quyền bỏ phiếu; hết câm đêm sau.                              |
| Tiên tri hào quang | Chỉ thường/đặc biệt; Kẻ say rượu chưa tỉnh hiện thường; không lộ tên vai.                                                    |
| Tiên tri Sói       | Chỉ tìm Tiên tri thường; không được danh sách đàn; không bị soi thành Sói.                                                   |
| Tiên tri tập sự    | Cần Tiên tri trong bộ bài; bắt đầu từ đêm sau cái chết, chỉ khi không còn Tiên tri sống.                                     |
| Trưởng giáo phái   | Thu nạp người sống khác chưa thu nạp; không thông báo mục tiêu; xét thắng cá nhân cuối ván.                                  |
| Thần tình yêu      | Chọn hai người, được chọn mình; chỉ tiết lộ tên đối phương; chết dây chuyền và điều kiện cặp đôi khác phe.                   |
| Kẻ bị nguyền rủa   | Cứu/bảo vệ ngăn chuyển vai; vết cắn không bị chặn chuyển thành Sói, tham gia săn từ đêm sau.                                 |
| Con bệnh           | Chỉ chết trực tiếp do Sói gây nghỉ săn; ưu tiên hơn thưởng Sói con, không dồn lượt.                                          |
| Người nhân bản     | Nhận vai/phe và tài nguyên còn lại; không nhận vết thương/bảo hộ của người chết; giữ hiệu ứng cá nhân.                       |
| Kẻ say rượu        | Lá ẩn còn bản sao và thuộc danh sách hợp lệ; không lộ cho người chơi khác; tỉnh đầu đêm ba; tính phe ẩn khi kết thúc.        |
| Hồn ma             | Tự chết cuối đêm đầu; thao tác dù chết ở đêm sau; kiểm tra một chữ, chặn chữ đầu tên; chỉ công bố lúc sáng.                  |
| Thợ săn            | Được thao tác sau chết hoặc bỏ qua; không bị Bảo vệ chặn; xử lý hết chuỗi trước chốt thắng, kể cả chết do Ma cà rồng.        |
| Sói đơn độc        | Đi săn cùng đàn, mục tiêu thắng riêng; không được cộng thắng chỉ vì phe Sói thắng.                                           |
| Bà già             | Mục tiêu vẫn sống nhưng bị cấm nói/vote/đề cử trong ngày; hết tác dụng đầu đêm sau.                                          |
| P.I.               | Một lần; chọn mình được; xét người chọn và hai láng giềng sống trong vòng ngồi; xét Sói thật.                                |
| Chán đời           | Chết không tự kết thúc ván; xét thắng cá nhân cuối ván.                                                                      |
| Lực sĩ             | Chết cuối đêm sau vết cắn không bị chặn; bảo hộ/bình cứu sau đó không xóa vết thương cũ.                                     |
| Ma cà rồng         | Chọn chung mục tiêu; miễn Sói cắn; đánh dấu lúc đêm, chết sau phiên vote kể cả phiếu trắng; chặn Dân thắng sớm.              |
| Sói con            | Đàn được chọn hai người khác nhau vào đêm sau khi chết; được cả đàn chọn hy sinh; cứu chỉ một nạn nhân.                      |
| Tu sĩ              | Một lần; không chọn mình; bảo hộ chặn đúng một đòn, không phải mọi đòn trong cùng đêm.                                       |
| Du côn             | Chọn hai người khác; chỉ thắng khi sống cuối ván và cả hai mục tiêu chết.                                                    |
| Kẻ phá rối         | Kích hoạt một lần, thêm đúng một phiên vote; không kéo sang ngày sau; Hoàng tử vẫn kết thúc ngày.                            |
| Sói giả dân        | Sói thật đi săn; soi thường ra không phải Sói; P.I./Tiên tri bí ẩn không bị đánh lừa.                                        |
| Thám tử Mentalist  | Hai mục tiêu khác nhau; chỉ cùng/khác phe, không lộ vai; các mục tiêu thắng riêng không tự thành cùng phe.                   |
| Tiên tri bí ẩn     | Đúng tên vai hiện tại; không lộ lá ẩn Kẻ say rượu trước khi tỉnh.                                                            |
| Nữ thợ săn         | Một phát ban đêm hoặc giữ lại; có thể bị Bảo vệ/ban phước chặn, khác phát bắn cuối của Thợ săn.                              |

## Những luật dễ hiểu nhầm đã công bố rõ

- Thị trưởng được hai phiếu ở cả đề cử lẫn treo cổ. Đây là quy ước áp dụng cho luồng hai vòng của ứng dụng.
- Bà già khiến mục tiêu không thể bị đề cử hôm đó; vẫn bị tác động khác giết được.
- P.I. dùng hai hàng xóm còn sống, bỏ qua chỗ người chết. Quản trò cần sắp đúng vòng ngồi trước ván.
- Phù thủy chỉ cứu vết cắn Sói; không chữa vết cắn Ma cà rồng hoặc vết thương cũ của Lực sĩ. Bình độc vẫn có thể giết người vừa được bình cứu.
- Phép ban phước chặn một đòn. Nếu cùng người bị Sói cắn rồi trúng độc, đòn sau vẫn giết được. Bảo vệ chặn các đòn đêm trong cả đêm đó.
- Tiên tri Sói chỉ nhận diện Tiên tri thường, không gồm Tiên tri tập sự hoặc biến thể. Tiên tri hào quang xem Kẻ say rượu chưa tỉnh là vai thường.
- Cặp đôi khác phe phải là hai người sống cuối cùng; Trưởng giáo phái, Du côn và Chán đời xét mục tiêu cá nhân khi ván kết thúc, không tự kết thúc ván khi đạt mục tiêu.
- Phe Sói tính cả tay sai khi xét số lượng; Sói đơn độc có phe thắng riêng. Phải còn Sói thường/Sói con/Sói giả dân, không còn Ma cà rồng mới chốt thắng phe Sói theo số lượng.
- Thứ tự bình minh: vết thương Lực sĩ cũ → Sói → độc → Nữ thợ săn → đánh dấu Ma cà rồng → Hồn ma đêm đầu. Các hành động đã chốt trong đêm vẫn có hiệu lực nếu người dùng kỹ năng chết cùng bình minh. Thợ săn/chết theo người yêu được giải quyết trước kết quả cuối.

## Phạm vi kiểm chứng

- 84 kiểm thử Node gồm luật, tương tác, quyền truy cập và một ván thật qua nhiều Socket.IO client có khôi phục kết nối.
- Kiểm thử frontend riêng cho Thợ săn/Hồn ma sau chết, người bị Bà già cấm vote, kết quả cá nhân, bộ bài và thư viện.
- 29 vai mở rộng còn lại chỉ có hình/mô tả; vẫn khóa bởi server trong chế độ có logic. Chế độ chỉ dùng bộ bài cho chia các lá này để quản trò tự điều hành; không coi là logic tự động đã triển khai.
- Chưa mô phỏng mọi tổ hợp vai, chưa thay thế được một buổi chơi nhiều điện thoại thật. Những biến thể trên là quy ước rõ ràng của phiên bản này, không khẳng định là bộ luật duy nhất của mọi phiên bản Ma Sói.

Chạy lại: `pnpm test:werewolf`, `pnpm test:unit --run src/views/werewolf-host`, `pnpm build`, `pnpm lint:ci`.

## Bổ sung cơ chế phục hồi và chơi trực tiếp

- Làm lại đêm gần nhất bằng bản chụp trước đêm. Kiểm thử phục hồi người chết, tài nguyên, ghi chú, hiệu ứng, kết quả và điểm đã cộng; giữ kết nối hiện tại, từ chối lệnh cũ và không làm lộ bản chụp/token. Kiểm thử Socket.IO xác nhận người chơi tiếp tục thao tác được sau phục hồi.
- Không phục hồi qua một ván mới hoặc khi danh sách thành viên đã thay đổi. Thông tin đã được người chơi biết không thể hoàn tác.
- Chế độ chỉ dùng bộ bài: chặn mọi bước tự động sau chia, cho dùng các vai chưa có logic, không có đồng hồ/phiếu/kỹ năng tự động; kết thúc do quản trò xác nhận, không tự tính điểm. Kiểm tra riêng bảo mật vai trước kết thúc và quyền quản trò.
- Sau bổ sung: 89 kiểm thử backend/Socket.IO và 46 kiểm thử toàn frontend đã đạt.
