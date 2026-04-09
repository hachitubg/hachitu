# HACHITU Light Design System

Design direction: **Warm Daylight Editorial**

Mục tiêu là giữ tinh thần có cá tính, có tính biên tập, nhưng sáng hơn, thoáng hơn, và phù hợp với một dự án cá nhân thay vì một launcher cộng đồng nền tối.

## Nguyên tắc

- Sáng nhưng không nhợt
- Ấm nhưng không cam gắt
- Rõ cấp bậc thị giác
- Giữ cách đặt tên token hiện tại để giảm chi phí migrate
- Ưu tiên tương phản tốt trên nền sáng

## Bộ token đề xuất

Giữ nguyên tên token cũ trong `src/assets/main.css`, chỉ thay giá trị:

```css
@theme {
  --color-bg-deep: #f6efe6;
  --color-bg-surface: #fffaf4;
  --color-bg-elevated: #f3e2cf;

  --color-accent-coral: #d9654f;
  --color-accent-amber: #c88b18;
  --color-accent-sky: #3f7ea6;

  --color-text-primary: #2f241f;
  --color-text-secondary: #6d5a4c;
  --color-text-dim: #9b8472;

  --color-border-default: #e2d1c2;
  --color-border-hover: #d9654f;

  --font-display: 'Anybody', sans-serif;
  --font-body: 'Be Vietnam Pro', sans-serif;
}
```

## Ý nghĩa token

### Backgrounds

- `bg-bg-deep`
  - nền tổng thể của trang
  - dạng giấy kem sáng, không trắng tinh
- `bg-bg-surface`
  - card, khối nội dung, panel
- `bg-bg-elevated`
  - hover state, input, block nhấn mạnh

### Accents

- `accent-coral`
  - CTA chính, tiêu đề nhấn, border hover
- `accent-amber`
  - badge phụ, metadata nhấn, số thứ tự
- `accent-sky`
  - link, điều hướng, trạng thái tương tác phụ

### Text

- `text-primary`
  - nội dung chính
- `text-secondary`
  - mô tả, hỗ trợ
- `text-dim`
  - metadata, ghi chú, icon ít quan trọng

## Nền sáng thì cần đổi gì ngoài token

Chỉ đổi token là chưa đủ. Những pattern sau cần rà bằng mắt:

- mọi chỗ dùng `text-bg-deep` trên nền accent
- mọi block có `backdrop-blur` + nền tối trong suốt
- shadow màu coral quá đậm
- phần shimmer có highlight trắng mạnh
- ảnh badge có thể lệch tông với nền sáng

## Phong cách hình ảnh

### Nên dùng

- nền giấy sáng, kem, cát, ivory
- điểm nhấn coral đất và amber đậm
- border mảnh, rõ
- card sắc cạnh
- typography lớn, rõ, có nhịp

### Không nên dùng

- trắng tinh toàn bộ
- gradient tím
- cyan neon
- gray lạnh kiểu dashboard SaaS mặc định
- drop shadow đen dày

## Typography

Tiếp tục giữ:

- `font-display`: Anybody
- `font-body`: Be Vietnam Pro

### Scale gợi ý

- Hero title: `font-display text-6xl md:text-8xl font-bold tracking-tight`
- Section title: `font-display text-2xl font-semibold`
- Card title: `font-display text-lg font-semibold`
- Body: `text-sm` hoặc `text-base`
- Metadata: `text-xs text-text-dim font-display tracking-wide`

## Thành phần giao diện

### Page background

```html
<div class="min-h-screen bg-bg-deep text-text-primary font-body">
```

### Card

```html
class="border border-border-default bg-bg-surface p-6
       transition-all duration-300
       hover:-translate-y-1 hover:border-accent-coral hover:bg-bg-elevated
       hover:shadow-lg hover:shadow-accent-coral/10"
```

Lưu ý:

- với nền sáng, `shadow-accent-coral/10` là đủ
- không cần bóng quá nặng

### Input

```html
class="w-full border border-border-default bg-bg-surface px-3 py-2
       text-sm text-text-primary placeholder:text-text-dim
       focus:border-accent-coral focus:bg-white focus:outline-none"
```

### Primary button

```html
class="inline-flex items-center gap-2 border border-accent-coral
       bg-accent-coral px-5 py-3 font-display font-semibold
       text-bg-surface transition hover:brightness-95"
```

### Secondary button

```html
class="inline-flex items-center gap-2 border border-border-default
       bg-bg-surface px-5 py-3 font-display font-semibold
       text-text-secondary transition hover:border-accent-sky hover:text-accent-sky"
```

## Hero section cho HACHITU

Hero nên có cảm giác cá nhân hơn repo gốc:

- bỏ ngôn ngữ cộng đồng
- headline ngắn, rõ
- subtitle nói rõ `HACHITU` là gì
- CTA dẫn thẳng tới app list hoặc app nổi bật

### Hướng bố cục

- title lớn lệch nhẹ
- một badge nhỏ ở góc
- subtitle có border trái coral
- nền có pattern chấm hoặc hạt giấy rất nhẹ

## Navbar trên nền sáng

Navbar của repo gốc đang thiên về dark glass. Với `HACHITU`, nên chuyển sang:

```html
class="fixed top-0 left-0 right-0 z-40 bg-bg-deep/85 backdrop-blur-md border-b border-border-default"
```

Nhưng cần chú ý:

- chữ idle phải đủ đậm
- hover không được quá mờ
- dropdown nên dùng `bg-bg-surface` thay vì `bg-bg-deep/95`

## Edge toolbar trên nền sáng

Toolbar nên giữ chức năng nhưng giảm cảm giác nặng:

- panel: `bg-bg-surface/95`
- trigger: `bg-bg-elevated/80`
- hover item: `bg-bg-elevated`
- text mặc định: `text-text-secondary`
- active favorite: `text-accent-coral`

## Noise overlay

Repo gốc đang dùng overlay hạt giấy ở `opacity: 0.025`.

Với nền sáng:

- giảm còn khoảng `0.015` đến `0.02`
- nếu texture tối quá, hãy thay file texture sáng hơn

## Dot divider

Có thể giữ pattern chấm, nhưng nên giảm độ tương phản:

```html
<span class="w-1 h-1 rounded-full bg-border-default" />
```

## Section marker

Marker `//` vẫn nên giữ vì đây là một chi tiết nhận diện tốt.

Ví dụ:

```html
<h2 class="font-display text-2xl font-semibold text-text-primary flex items-center gap-3">
  <span class="text-accent-coral text-sm tracking-widest">//</span>
  App nổi bật
</h2>
```

## Migrate nhanh từ repo gốc

### Bước 1

Đổi token trong `src/assets/main.css`.

### Bước 2

Rà 4 file này trước:

- `src/components/home/HeroSection.vue`
- `src/components/AppNavbar.vue`
- `src/components/EdgeToolbar.vue`
- `src/components/PageCard.vue`

### Bước 3

Sau khi nhìn ổn ở homepage, mới rà tiếp:

- category page
- bookmarks page
- not found page
- từng mini-app cũ nếu bạn copy sang

## Kiểm tra chất lượng sau khi đổi theme

- tiêu đề chính có đủ nổi không
- text phụ có còn đọc tốt trên mobile không
- border card có bị chìm không
- dropdown có đủ tách lớp không
- CTA coral có bị quá rực trên nền kem không
- hover state có đủ rõ mà không quá tối không

## Kết luận

Light theme cho `HACHITU` nên đi theo hướng "ấm, biên tập, sáng, có cá tính", không nên biến thành giao diện SaaS trắng-xám phổ thông. Cách migrate tốt nhất là giữ nguyên hệ token hiện có, thay giá trị trước, rồi chỉnh cục bộ những component còn mang giả định nền tối.
