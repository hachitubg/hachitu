# HACHITU Blueprint

Tài liệu này là bản thiết kế để tách `vibe.j2team.org` thành một dự án cá nhân mới tên là `HACHITU` nhưng vẫn giữ lại stack, nhịp làm việc, và những phần kiến trúc tốt của repo gốc.

## Mục tiêu

- Dùng lại stack hiện tại: Vue 3.5, TypeScript strict, Vite 7, Tailwind CSS v4, Vue Router 5, Pinia 3, Unhead, VueUse, Iconify
- Giữ mô hình `launcher + sub-apps`
- Đổi định danh dự án từ `vibe.j2team.org` sang `HACHITU`
- Đổi giao diện sang tông sáng hơn, ấm hơn, ít cảm giác "dark editorial"
- Loại bỏ những phần gắn chặt với ngữ cảnh cộng đồng J2TEAM nếu không cần cho dự án cá nhân

## Hướng mở rộng mới: multiplayer realtime

Nếu bạn muốn biến `HACHITU` thành nền cho các game online giữa bạn bè, kiến trúc được khuyến nghị là:

- Durable Objects
- WebSocket
- SQLite-backed room storage
- cleanup theo TTL của từng room

Tài liệu chi tiết:

- `docs/HACHITU_MULTIPLAYER_ARCHITECTURE.md`
- `docs/HACHITU_APP_API_GUIDELINES.md`

## Hướng mở rộng mới: app-level API

Khi một mini-app mới trong `src/views/<app>/` cần gọi thêm API, hướng thiết kế đúng không phải là dồn toàn bộ request vào một file global.

Thay vào đó:

- frontend client của app nằm gần app đó trong `src/views/<app>/api/`
- backend route và business logic của app nằm trong `worker/`
- shared layer chỉ giữ những primitive dùng lại nhiều app

Tài liệu chi tiết:

- `docs/HACHITU_APP_API_GUIDELINES.md`

## Kiến trúc nên giữ nguyên

Các phần dưới đây là lõi tốt của repo gốc, nên copy gần như nguyên trạng:

- `src/main.ts`
- `src/router/index.ts`
- `src/assets/main.css`
- `src/types/page.ts`
- `src/data/pages-loader.ts`
- `src/stores/usePagesStore.ts`
- `src/stores/useFavoritesStore.ts`
- `src/stores/useRecentlyViewedStore.ts`
- `scripts/generate-pages-json.mjs`
- `scripts/create-page.mjs`
- `scripts/generate-og-pages.mjs`
- `scripts/generate-sitemap.mjs`
- `vite.config.ts`
- `tsconfig*.json`
- `eslint.config.ts`
- `.oxlintrc.json`
- `.oxfmtrc.json`
- `wrangler.json`

Lý do giữ:

- Auto-routing theo `src/views/<slug>/meta.ts` rất hợp với mô hình nhiều mini-app
- `pages.json` giúp homepage và router tách khỏi build bundle
- Pinia stores đang tối giản và đủ sạch
- Pipeline build đã có sẵn SEO, sitemap, OG pages, Cloudflare deploy

## Phần nên thay hoặc bỏ

### Bắt buộc rebrand

- `package.json`
  - đổi `name`
- `index.html`
  - đổi `title`, `meta description`, favicon, fonts nếu muốn
- `wrangler.json`
  - đổi `name`
- `src/App.vue`
  - đổi `SITE_NAME`, `SITE_URL`, `DEFAULT_TITLE`, `DEFAULT_DESCRIPTION`
- `src/router/index.ts`
  - đổi toàn bộ title/description mặc định
- `src/data/constants.ts`
  - đổi `REPO_URL`
- `README.md`
  - viết lại theo bối cảnh cá nhân

### Nên xem xét bỏ

Nếu `HACHITU` là dự án cá nhân, không phải cộng đồng nhiều contributor:

- `src/views/LeaderboardPage.vue`
- `src/views/MembersPage.vue`
- `src/views/ContributorsPage.vue`
- `src/views/AuthorPage.vue`
- dữ liệu và UI liên quan đến `authors.ts`
- phần "community products", "contribute", "sponsors" trên homepage

### Có thể giữ nhưng đổi vai trò

- `BookmarksPage.vue`
  - vẫn hữu ích nếu `HACHITU` có nhiều mini-app
- `EdgeToolbar.vue`
  - nên giữ vì tiện cho điều hướng, bookmark, source
- `PageCard.vue`
  - giữ nguyên cấu trúc, chỉ cần áp theme sáng

## Hai hướng tổ chức cho HACHITU

### Hướng A: Launcher cá nhân nhiều mini-app

Phù hợp nếu bạn muốn một "vườn dự án" cá nhân.

Giữ:

- auto-routing
- trang chủ dạng launcher
- bookmarks
- recently viewed
- category pages
- edge toolbar

Bỏ hoặc giản lược:

- leaderboard
- members
- contributors
- author ranking

### Hướng B: Portfolio sản phẩm cá nhân

Phù hợp nếu bạn muốn mỗi app là một sản phẩm trưng bày.

Giữ:

- auto-routing
- homepage grid
- SEO pipeline

Đổi:

- category thành "product type" hoặc "tag"
- author thành owner duy nhất
- toolbar thêm link demo/docs nếu cần

## Cấu trúc repo đề xuất

```text
hachitu/
  docs/
    HACHITU_BLUEPRINT.md
    HACHITU_LIGHT_DESIGN_SYSTEM.md
    HACHITU_MULTIPLAYER_ARCHITECTURE.md
    HACHITU_APP_API_GUIDELINES.md
  public/
    shared/
    data/
  scripts/
  src/
    assets/
    components/
      home/
      shared/
    composables/
      shared/
    data/
    router/
    stores/
    types/
    views/
      HomePage.vue
      BookmarksPage.vue
      CategoryPage.vue
      NotFound.vue
      hello-world/
      <your-app>/
  package.json
  vite.config.ts
  wrangler.json
```

## Nếu triển khai game online

Lúc đó cấu trúc repo nên mở rộng thêm backend layer:

```text
hachitu/
  worker/
    index.ts
    routes/
      apps/
    durable-objects/
    multiplayer/
    apps/
```

Giải thích:

- `worker/index.ts` làm entry cho API + WebSocket upgrade
- `durable-objects/` chứa room logic
- `multiplayer/` chứa protocol, validator, TTL, helper
- `routes/apps/` chứa route theo từng app
- `apps/` chứa service, schema, và logic backend theo từng app

Frontend SPA vẫn giữ nguyên ở `src/`, nhưng `wrangler` sẽ cần chuyển từ cấu hình assets-only sang Worker + assets.

## Kế hoạch migrate thực dụng

### Bước 1: Tạo repo mới

1. Copy repo hiện tại sang repo mới tên `hachitu`
2. Xóa `dist/`, cache local, file rác ngoài dự án
3. Đổi `package.json`, `wrangler.json`, `README.md`
4. Chạy:

```sh
pnpm install
pnpm build
```

### Bước 2: Rebrand runtime

Sửa các file sau trước:

- `src/App.vue`
- `src/router/index.ts`
- `src/data/constants.ts`
- `index.html`
- `scripts/generate-og-pages.mjs`
- `scripts/generate-sitemap.mjs`

Những giá trị cần chuẩn hóa:

- `SITE_NAME`
- `SITE_URL`
- default SEO title
- default description
- repo URL
- analytics ID nếu có

### Bước 3: Gọn homepage

Nếu là dự án cá nhân, homepage nên còn:

- hero
- pages grid
- category filter
- bookmarks/recently viewed
- footer

Nên bỏ hoặc tách riêng:

- products section
- sponsors section
- contribute section kiểu cộng đồng
- star goal CTA nếu không còn hợp ngữ cảnh

### Bước 4: Dọn route không còn phù hợp

Tối thiểu hãy rà:

- `src/router/index.ts`
- `src/views/HomePage.vue`
- `src/data/homepage.ts`
- mọi component trong `src/components/home/`

Nếu route bị bỏ, nhớ:

- xóa import/lazy import liên quan
- xóa link trên navbar
- xóa block dữ liệu không dùng

### Bước 5: Áp light theme

Không nên đổi class khắp nơi ngay từ đầu.

Làm đúng theo thứ tự:

1. Giữ nguyên tên token hiện tại trong `src/assets/main.css`
2. Chỉ đổi giá trị token
3. Chạy app và rà các điểm tương phản
4. Chỉnh từng component đặc biệt như navbar, hero, toolbar

Chi tiết theme nằm ở `docs/HACHITU_LIGHT_DESIGN_SYSTEM.md`.

## Mapping file theo mức ưu tiên

### Ưu tiên 1

- `src/assets/main.css`
- `src/App.vue`
- `src/router/index.ts`
- `index.html`
- `src/data/constants.ts`

### Ưu tiên 2

- `src/views/HomePage.vue`
- `src/components/home/HeroSection.vue`
- `src/components/AppNavbar.vue`
- `src/components/EdgeToolbar.vue`
- `src/components/PageCard.vue`

### Ưu tiên 3

- `src/data/homepage.ts`
- `README.md`
- `scripts/generate-og-pages.mjs`
- `scripts/generate-sitemap.mjs`

## Các điểm cần cẩn thận

- Repo gốc giả định ngữ cảnh cộng đồng, nên nhiều copy text đang hard-code J2TEAM
- Một số component mobile đang dùng `rounded-lg`, trái với design system gốc; nếu muốn nhất quán hơn cho `HACHITU` thì nên chuẩn hóa lại
- `README.md` và vài file Markdown hiện có vấn đề encoding trong terminal Windows, nhưng nội dung source vẫn có thể đang đúng UTF-8; khi migrate nên mở trực tiếp trong editor để kiểm tra
- `index.html` đang có Google Analytics của repo gốc, không nên mang sang dự án mới

## Checklist tạo HACHITU bản đầu

- Đổi tên package, site, repo URL
- Bỏ analytics cũ
- Áp light theme token
- Gọn navbar theo đúng route còn dùng
- Gọn homepage theo ngữ cảnh cá nhân
- Giữ lại generator `create:page`
- Giữ lại `pages.json` pipeline
- Giữ lại bookmarks và recently viewed
- Chạy `pnpm build`
- Chạy `pnpm lint:ci`

## Phiên bản HACHITU đầu tiên nên có gì

Tôi khuyên `v1` chỉ nên có:

- homepage launcher
- category filter
- bookmarks
- 3 đến 8 mini-app đầu tiên
- edge toolbar
- SEO cơ bản

Nếu muốn làm multiplayer thì `v1 multiplayer` nên thật nhỏ:

- 1 game turn-based đơn giản
- room theo link mời
- WebSocket realtime
- không account
- không leaderboard
- TTL cleanup theo room

Chưa cần ở `v1`:

- contributor system
- leaderboard
- member pages
- sponsor area
- các section CTA mang tính cộng đồng

## Kết luận

`vibe.j2team.org` là một base tốt cho `HACHITU` vì kiến trúc routing, dữ liệu trang, build pipeline, và state layer đã đủ mạnh. Việc chuyển sang dự án cá nhân nên tập trung vào ba việc:

1. bỏ bối cảnh cộng đồng
2. rebrand toàn bộ metadata
3. đổi design token sang light theme thay vì viết lại toàn bộ UI

## Mở rộng AI về sau

Nếu `HACHITU` có nhiều mini-app cần AI:

- dùng một AI gateway chung trong `worker/`
- giữ `OPENROUTER_API_KEY` ở backend
- frontend của từng app chỉ gọi `/api/ai/chat`
- mặc định dùng `openrouter/free` nếu muốn ưu tiên free-first và tự fallback trong nhóm model miễn phí

Tài liệu chi tiết:

- `docs/HACHITU_AI_API_GUIDELINES.md`
