# HACHI Studio

Route: `/hachi-studio`. Camera trước/sau, chụp ảnh, nhập ảnh, 63 preset riêng và 12 LUT film thực,
độ mạnh 0–100%, tỷ lệ 3:4 / 1:1 / 4:3, lưới bố cục và bấm bật/tắt ảnh gốc. Không có hẹn giờ.

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
- Desktop và mobile: bộ màu cuộn, tỷ lệ ảnh, lưới, bấm xem gốc và input file.
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
- Đặt lại custom giữ preset đang chọn. Đổi ảnh reset custom. Bấm ảnh gốc tạm bỏ màu/Makeup/custom để so sánh; bấm lần nữa quay lại ảnh chỉnh.
- Lưu tối đa 20 công thức trên thiết bị bằng VueUse localStorage; công thức gồm preset, độ mạnh và custom.
- 12 preset mới: Film cổ điển, Nghệ thuật, Cinema. Các preset hiện tại là công thức HACHITU, không phải LUT hãng.
- Nguồn LUT tham khảo: https://github.com/andreavolpato/spektrafilm và https://github.com/YahiaAngelo/Film-Luts
- Đã tích hợp 12 LUT sRGB từ `cedeber/hald-clut`, bộ dữ liệu RawTherapee Film Simulation (CC BY-SA 4.0). Ghi nguồn trong giao diện và `public/hachi-studio/luts/`. Không dùng LUT Log/ACES trực tiếp cho ảnh thông thường.

## LUT film thực và Auto Color

- LUT data lấy từ revision `3b3180f82d4dcea1e6e8c5648473539a910d7f49`, chỉ bộ Film Simulation có giấy phép riêng CC BY-SA 4.0, không sao chép code GPL của repo.
- Nhóm Film Pro, Cinema LUT, B&W Pro gồm 12 LUT. Chuyển Hald sang lưới RGB 32^3 bằng nội suy 3D; PNG atlas 256x128, khoảng 17–94 KB/file.
- `tools/prepare-luts.mjs` tái tạo asset; không chạy khi build/deploy. Asset đã có trong public, tải khi mở/chọn bộ màu. `utils/lut.ts` cache Image và kiểm tra kích thước.
- Shader dùng nội suy trilinear và precision highp cho chỉ số LUT. Cùng texture/độ mạnh cho camera, thumbnail, preview và xuất ảnh/video.
- Thumbnail tạo từ ảnh đang chỉnh (bản nhỏ), không upload ảnh. Khi chọn LUT đang tải, chặn lưu để không xuất sai màu.
- Studio > Màu > Cân màu tự động: phân tích histogram sau preset/Makeup/crop và bỏ pixel trong suốt. Giới hạn tăng exposure theo vùng sáng 95%, mở vùng tối có chọn lọc; white balance chỉ ước lượng khi có đủ vùng gần trung tính.
- Custom có thêm Vùng tối/Vùng sáng. Công thức cũ thiếu hai giá trị này được áp với mặc định 0.
- Auto không gọi API AI, không đo màu thiết bị, không nhận diện ý đồ nghệ thuật. Có Hoàn tác Auto và chỉnh tay sau đó; giữ preset đang chọn.
- Kiểm thử `pnpm test:unit --run src/views/hachi-studio/utils/auto-color.test.ts`.

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

## Hiển thị ảnh và crop trực tiếp

- Ảnh nhập giữ tỷ lệ gốc; vùng trống dùng nền sáng, không kéo giãn ảnh hoặc tự che bớt ảnh để lấp khung.
- Studio > Công cụ > Crop vào chế độ riêng, không mở modal che hoặc chặn ảnh.
- Có thể kéo trên toàn vùng stage, kể cả vùng ngoài ảnh. Pointer capture giữ cử chỉ xuyên suốt; chụm hai ngón zoom 1–3x. Cơ chế chặn lộ vùng rỗng khi pan.
- Có tỷ lệ Gốc, 3:4, 1:1, 4:3, 9:16; đặt lại, Xong, Hủy. Hủy/Escape khôi phục tỷ lệ và framing trước khi crop.
- Khi zoom 1x và toàn bộ ảnh vừa khung, không còn vùng dư để pan; phóng to hoặc đổi tỷ lệ để dịch khung.
- Nút Ảnh gốc dùng click và aria-pressed; không còn nhấn giữ, chặn callout/chọn chữ trên nút.
- Kiểm thử: `pnpm test:unit --run src/views/hachi-studio/utils/crop.test.ts`.

# Tối ưu thao tác và preview

## Ghép ảnh / Photobooth

- Giao diện ghép ảnh vừa một màn hình: ảnh xem trước co giãn theo không gian còn lại; Khung, Tỷ lệ và Nền/viền chỉ mở khi bấm công cụ, không cuộn toàn trang.
- Kéo tay nắm màu cam giữa các ô bằng chuột hoặc cảm ứng để đổi kích thước ô. Có thể dùng phím mũi tên khi tay nắm được focus. Kéo bên trong ảnh vẫn là căn vị trí ảnh, không thay bố cục.
- Các ô liền kề dùng chung đường chia; giới hạn kích thước tối thiểu để tránh mất ô/chồng ảnh. Đặt lại ô khôi phục kích thước mẫu nhưng giữ ảnh.
- Xuất ảnh và camera dùng kích thước ô đã điều chỉnh, không dùng lại tỷ lệ mẫu cố định.

- Mục Ghép ảnh có 16 bố cục cho 2, 3, 4 ảnh; Story 9:16, Post 4:5, vuông và dải Photo strip.
- Chọn từng ô rồi chọn ảnh hoặc Chụp mới. Camera hiển thị đúng tỷ lệ ô, hỗ trợ camera trước/sau, chụp thủ công từng ảnh, không hẹn giờ.
- Kéo để căn ảnh, chụm hai ngón, lăn chuột hoặc dùng thanh zoom 1–4×. Giới hạn crop để không lộ khoảng trống trong ô.
- Tùy chỉnh nền, khoảng cách, viền ngoài; xuất JPEG rộng 1080 px (Story cao 1920 px).
- Ảnh ghép giữ trong bộ nhớ khi chuyển lại Studio, không lưu sau khi tải lại trang; không upload ảnh hay camera lên server.
- Mỗi ảnh nhập được giảm cạnh dài xuống tối đa 2000 px để giới hạn RAM. Đổi bố cục giữ ảnh theo thứ tự ô.
- Thư viện màu và bố cục hỗ trợ kéo ngang bằng chuột; kéo không kích hoạt lựa chọn ngoài ý muốn.

- Chỉ tạo preview màu khi mở thư viện; chia công việc thành từng lượt để không khóa giao diện.
- Cache preview theo ảnh đang chỉnh, xóa cache khi đổi ảnh; không tạo lại khi mở bảng màu lần nữa.
- Gộp thay đổi slider theo nhịp màn hình; video đang dừng không render liên tục.
- Bảng màu không làm tối ảnh, ưu tiên thư viện và độ mạnh. Tùy chỉnh nâng cao vẫn mở riêng.
- Bấm lại nút công cụ để đóng, hoặc dùng Xong/Escape. Xuất ảnh vẫn giữ chất lượng riêng với preview.
