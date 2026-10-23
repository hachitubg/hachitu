# Rà soát luật các lá bài

## Rà soát 22/10/2026

Chạy lại audit đầy đủ: 28.486 ván đạt (1.229 cặp, 19.799 bộ ba, 5.000 ván ngẫu nhiên), 2.550 lần reset, 7.183 lần mất kết nối giả lập, 65.779 lệnh không hợp lệ bị từ chối. Rà soát thêm selection/confirmation, thứ tự xử lý đêm, quyền xem vai và resume. Không tìm thấy lỗi luật mới trong phạm vi này. 50 vai tự động và 17 vai chỉ chia bài vẫn được phân biệt rõ; không khẳng định 17 vai đó đã có logic tự động.

Sửa giới hạn thao tác Socket.IO: tính theo kết nối, không dùng chung địa chỉ IP vì cả bàn có thể chung Wi-Fi hoặc qua nginx loopback. Thêm regression hai client cùng IP để một client quá giới hạn không chặn client khác tạo phòng. Việc này không thay đổi luật role.

## Mở rộng kiểm thử tổ hợp

Đã bổ sung bộ audit tái lập, quét toàn bộ cặp/bộ ba role theo số lá vật lý và 5.000 ván ngẫu nhiên. Chi tiết phạm vi, giới hạn và lệnh chạy nằm trong [TESTING.md](./TESTING.md); báo cáo mới nhất có checksum nguồn tại `server/werewolf/test-results/audit-full.json`.

Tìm được và sửa lỗi: Người nhân bản nhận Sói đau khổ trong chuỗi chết nhưng không chết dù mục tiêu liên kết đã chết. Thêm regression độc lập, xác nhận thất bại trước sửa và đạt sau sửa; không cho ban phước chặn cái chết liên kết. Thêm test Socket.IO thật cho vote đồng thời, phiếu lặp và khôi phục Kẻ tử đạo/Bloody Mary khi đang có lượt.

## Cập nhật 20/10/2026: bảy vai mở rộng và chuyển pha mới

Hiện có **50 vai có logic**, 17 vai chỉ dùng trong chế độ bộ bài. Bổ sung Kẻ tử đạo, Bloody Mary, Yêu tinh, Người chứng kiến, Sói chiêm bao, Sói tuổi teen, Xác ướp theo JSON chủ dự án cung cấp. README và `guide_vi` nêu rõ những quy ước tương tác khi JSON chưa có chi tiết.

- Kẻ tử đạo: chờ đủ xác nhận, cứu/không cứu, miễn Hoàng tử trước, chỉ một người tình nguyện chết, xử lý Thợ săn và tình yêu trước kết quả.
- Bloody Mary: phân biệt nguyên nhân chết Sói/Dân/Ma cà rồng, thao tác khi chết, kiểm tra phe mục tiêu mà không lọc danh sách làm lộ vai, kết quả cá nhân đúng theo phe cần báo thù.
- Yêu tinh: chuyển vết cắn trước Phù thủy, dùng bảo hộ trên người nhận mới, cấm trùng hai vết cắn, kích hoạt chuyển vai Kẻ bị nguyền, xử lý nhiều Yêu tinh theo lượt riêng.
- Người chứng kiến: chỉ báo Tiên tri thường, bảo mật hai chiều và không lộ danh tính Kẻ say rượu có lá ẩn Tiên tri.
- Sói chiêm bao: không thao tác/nhận đề xuất khi ngủ; tay sai chết không đánh thức; Sói thật chết thì thức từ đêm sau. Cờ được phục hồi khi reset.
- Sói tuổi teen: bước kiểm tra cuối ngày dành riêng quản trò, không mặc định kết quả; bị câm được miễn; phải xác nhận lại từng ngày; chết do vi phạm trước khi sang đêm.
- Xác ướp: ghi đè đề cử và phán quyết, giữ trọng số Thị trưởng, không kẹt nếu người điều khiển chết, chuỗi/vòng lặp được xử lý hữu hạn.
- Có thêm 12 ván mô phỏng hỗn hợp cả bảy vai với role cũ; tất cả kết thúc được và không lộ vai/token trong view công khai. Có kiểm thử UI thao tác mới và reset từ bước kiểm tra cuối ngày.
- Kết quả: **136 test backend/Socket.IO, 53 test frontend, build và lint đạt**. Đây là kiểm chứng các ca đã thiết kế và mô phỏng, không khẳng định đã bao phủ mọi tổ hợp ngoài thực tế.

## Cập nhật 20/10/2026: Người khám phá dùng một lần

Mở Người khám phá với biến thể chủ dự án yêu cầu: được bỏ qua mỗi đêm để giữ lượt, chọn mục tiêu tối đa một lần trong ván, kể cả đoán đúng cũng không tái sử dụng. Quy ước xử lý bảo hộ, phạt chọn nhầm và thời điểm xác định Sói được công bố trong README và `guide_vi`.

Đã kiểm tra: bỏ qua rồi dùng ở đêm sau; khóa lượt đã dùng; không chọn mình/hai người; Sói giả dân là Sói thật; Người lai Sói gây hình phạt; bảo vệ không ngăn tiêu hao; hình phạt không được bảo hộ chặn; Kẻ bị nguyền đổi vai cùng bình minh; Người khám phá chết cùng đêm vẫn có tác dụng; kế thừa tài nguyên và reset đêm. Tổng 111 test backend/Socket.IO đạt. Hiện có 43 vai tự động, 24 vai chỉ chia bài.

## Cập nhật 20/10/2026: bốn Sói Wolfpack

Hiện có 42 vai có logic tự động và 25 vai chỉ dùng trong chế độ bộ bài. Bổ sung Sói trùm, Sói đau khổ, Sói ăn chay và Nanh Sói theo JSON gốc. Quy ước chi tiết và giới hạn đối chiếu nguồn được ghi trong README, mục Bốn Sói mở rộng. Các phần bên dưới giữ kết quả rà soát ban đầu ngày 18/10.

- Sói trùm: một hoặc hai mục tiêu, kiểm tra kề nhau trong vòng sống kể cả đầu/cuối, đồng thuận cả đàn; Sói con ưu tiên hai mục tiêu bất kỳ, không cộng dồn; Con bệnh chặn lượt. Giao diện và server cùng kiểm tra số mục tiêu/kề nhau.
- Sói đau khổ: lượt liên kết đầu đêm một, thông tin riêng; chết theo một chiều, không bị ban phước chặn; xử lý Thợ săn xong mới chốt thắng. Kiểm thử kế thừa của Người nhân bản, reset đêm và xóa liên kết ván sau.
- Sói ăn chay: bỏ lượt săn nếu chỉ còn mình, kể cả còn Kẻ phản bội hay thưởng Sói con; vẫn có thể thắng theo số lượng. Khi Nanh Sói còn sống nhưng ngủ, Sói ăn chay vẫn được săn.
- Nanh Sói: nhận tên đàn đêm đầu, tham gia săn; những đêm sau ngủ nếu còn Sói khác. Không có action/choices khi ngủ, server chặn lệnh giả. Thức lại đầu đêm khi là Sói thật cuối.
- Cả bốn là Sói thật khi Tiên tri/P.I. kiểm tra, không phải vai ngụy trang. Đã đưa vào kiểm thử luồng nhiều vòng và kiểm thử thắng theo phe.
- Kết quả cập nhật: 105 test backend/Socket.IO, 48 test frontend đạt; build và lint đạt. Hình riêng đã có trong atlas mở rộng.

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
