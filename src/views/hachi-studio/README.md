# HACHI Studio

Route: `/hachi-studio`. Camera trước/sau, chụp ảnh, nhập ảnh, 63 preset màu riêng của HACHITU,
độ mạnh 0–100%, tỷ lệ 3:4 / 1:1 / 4:3, lưới bố cục và giữ xem ảnh gốc. Không có hẹn giờ.

## Xử lý ảnh

`data/looks.ts` chứa các công thức màu sRGB tự tạo, không sao chép LUT thương mại.
`utils/renderer.ts` dùng WebGL để áp cùng một shader cho preview, thumbnail và ảnh JPEG xuất.
Preset điều chỉnh exposure, contrast, saturation, warmth, tint và lifted blacks (fade).
Thumbnail dùng cảnh minh họa được vẽ nội bộ, không phải ảnh người dùng.

Preview tối đa 720px, camera cập nhật khoảng 15 fps để giảm tải. Ảnh nhập/chụp và xuất giới hạn
cạnh dài 2560px; tỷ lệ được crop ở giữa. Camera trước được mirror cả preview lẫn ảnh lưu.
Ảnh xử lý trên thiết bị, không upload. Rời trang sẽ dừng camera và giải phóng URL/context.

## Kiểm tra thực tế

- Safari iPhone và Chrome Android: cấp/từ chối quyền, đổi camera, chụp và lưu JPEG.
- Nhập JPEG/PNG/WebP; định dạng khác phụ thuộc khả năng decode của trình duyệt.
- 0% phải giống ảnh gốc. Màu khi xem trước phải giống màu JPEG xuất.
- Desktop và mobile: bộ màu cuộn, tỷ lệ ảnh, lưới, giữ xem gốc và input file.
- Camera cần HTTPS hoặc localhost. WebGL cần được bật trên thiết bị.

## Chỉnh sửa và video

- 20 màu theo chủ thể: đồ ăn, chân dung, cảnh vật và fashion, bên cạnh 31 màu ban đầu.
- Crop: tỷ lệ 3:4 / 1:1 / 4:3 / 9:16, zoom 1–3x và dịch khung; giữ nguyên nguồn ảnh.
- Hai không gian: Camera chỉ chọn màu và chụp; Studio nhập ảnh/video, màu, chữ và crop.
- Sau chụp có thể lưu ngay hoặc mở ảnh vào Studio. Chuyển giữa Camera/Studio dừng stream khi không dùng và giữ bản chỉnh đang làm.
- Các bảng chỉnh sửa chỉ mở khi chạm nút. Camera không áp chữ hay crop từ Studio lên live preview.
- Chữ tối đa 160 ký tự: 5 font, 3 kiểu (thường/nền/viền), căn lề, cỡ chữ, màu tùy ý và độ rõ 0–100%.
- Kéo chữ trực tiếp trên ảnh sau khi đóng bảng chỉnh sửa. Tọa độ chuẩn hóa theo khung và giữ nguyên khi xuất.
- Cùng hàm vẽ chữ được dùng cho preview và file xuất. Tạm bỏ giao diện địa điểm theo phạm vi hiện tại.
- Video nhập tối đa 60 giây, 120 MB. Xuất real-time ở 24 fps bằng canvas.captureStream + MediaRecorder.
- Video xuất KHÔNG CÓ ÂM THANH, giao diện thông báo rõ. Ưu tiên MP4, fallback WebM tùy trình duyệt.
- Xuất video cần giữ trang ở foreground. Có nút hủy; đổi tab sẽ hủy xuất và giải phóng track.
- Camera chỉ xin quyền video, không xin microphone. Chưa hỗ trợ dựng nhiều clip hay chỉnh audio.

## Makeup (ảnh tĩnh trong Studio)

- Mịn da, sáng da, thon mặt nhẹ, son môi (4 màu) và má hồng (3 màu), mức độ riêng 0–100%.
- Bắt đầu từ 0; có preset Tự nhiên, bật/tắt và đặt lại. Makeup không áp lên Camera hoặc video.
- MediaPipe Tasks Vision 0.10.21 được lazy-load từ jsDelivr khi người dùng mở Makeup.
- Model Face Landmarker float16 v1 từ Google được chạy một lần trên ảnh giảm xuống tối đa 1024px.
- Chỉ xử lý một khuôn mặt. Ảnh không có mặt có thông báo và không áp hiệu ứng; đổi ảnh reset Makeup.
- Nhận diện và hiệu ứng chạy trên thiết bị, không gửi ảnh tới API. Lần đầu cần mạng để tải SDK/WASM/model.
- Shader WebGL áp cùng mask/tọa độ trên preview và JPEG xuất, có xét crop và mirror camera trước.
- Mịn da làm dịu chi tiết nhỏ; không có công cụ xóa từng nốt mụn hay phục hồi ảnh bằng AI.
- Nguồn SDK: https://github.com/google-ai-edge/mediapipe (Apache-2.0). Tài liệu: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- Cần thử thêm trên Safari/iPhone thật; ảnh nghiêng, thiếu sáng, bị che mặt có thể nhận diện kém.

## Tự chỉnh màu và nguồn tham khảo

- Studio > Màu > Tự chỉnh màu: phơi sáng, tương phản, bão hòa, ấm/lạnh, tint, fade, sắc nét, tối góc.
- Custom áp sau preset và Makeup; cùng tham số khi xem trước và xuất. Camera không áp custom của Studio.
- Đặt lại custom giữ preset đang chọn. Đổi ảnh reset custom. Giữ ảnh gốc tạm bỏ màu/Makeup/custom để so sánh.
- Lưu tối đa 20 công thức trên thiết bị bằng VueUse localStorage; công thức gồm preset, độ mạnh và custom.
- 12 preset mới: Film cổ điển, Nghệ thuật, Cinema. Các preset hiện tại là công thức HACHITU, không phải LUT hãng.
- Nguồn LUT tham khảo: https://github.com/andreavolpato/spektrafilm và https://github.com/YahiaAngelo/Film-Luts
- Chưa tích hợp LUT bên ngoài. Khi tích hợp phải xác minh giấy phép từng file, giữ attribution và chọn input/output sRGB; LUT Log/ACES không thể dùng trực tiếp cho ảnh thông thường.

## Xóa phông và xóa vật (ảnh tĩnh)

- Xóa phông dùng MediaPipe ImageSegmenter, model selfie_multiclass_256x256 float32 v1. Chỉ tách người (gồm tóc, da, quần áo) khỏi nền; không phải bộ tách mọi loại sản phẩm.
- SDK/model chỉ tải khi mở công cụ, chạy trên thiết bị. Nền trong suốt xuất PNG; màu nền trơn xuất JPEG. Có nút khôi phục phông gốc.
- Xóa vật: tô mặt nạ trên preview bằng chuột/ngón tay, chọn cỡ cọ, xóa nét tô, xử lý và hoàn tác tối đa 2 lần.
- Mặt nạ được ánh xạ về tọa độ ảnh nguồn, có xét crop, zoom và mirror. Xử lý bằng Web Worker.
- Thuật toán inpainting cục bộ lan truyền màu từ biên vào vùng chọn. Hợp chi tiết nhỏ/nền đơn giản; không tái tạo vật lớn bằng AI. Giới hạn vùng chọn tối đa 15% ảnh.
- Ảnh nguồn trước mỗi lần xóa được giữ để undo. Đổi ảnh hủy worker và reset công cụ; rời trang giải phóng worker/model.
- Kiểm thử: `pnpm test:unit --run src/views/hachi-studio/utils/inpaint.test.ts`.

## Mờ hậu cảnh và nhóm Công cụ

- Studio gom Crop, Mờ hậu cảnh, Xóa phông, Xóa vật trong nút Công cụ. Có nút quay lại nhóm khi mở công cụ con.
- Mờ hậu cảnh cho ảnh có người: dùng chung mask MediaPipe với Xóa phông. Giữ foreground rõ và blur phần nền bằng WebGL, lấy mẫu ưu tiên vùng nền để giảm lem chủ thể.
- Mức 0–100%, preset Nhẹ 20 / Chân dung 45 / Đậm 80, có bật/tắt. 0% giữ nguyên ảnh.
- Preview và file lưu cùng bộ xử lý. Blur giữ nền và xuất JPEG với nguồn JPEG; cutout trong suốt vẫn xuất PNG.
- Đây là hiệu ứng chân dung mô phỏng, không đo khoảng cách quang học và chưa hỗ trợ chọn mọi loại chủ thể như đồ vật/hoa.
