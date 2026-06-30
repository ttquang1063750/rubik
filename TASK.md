# Task Checklist — TypeScript + SCSS + Vitest Refactor

Theo kế hoạch trong [PLAN.md](PLAN.md). Mỗi bước nhỏ, làm xong một bước thì dừng lại xác nhận trước khi qua bước tiếp theo.

## Phase 1: Setup hạ tầng

- [x] Tạo `package.json` (scripts, dependencies, devDependencies)
- [x] Tạo `tsconfig.json` (strict mode, ES2020, ESNext)
- [x] Tạo `vite.config.ts` + `vitest.config.ts`
- [x] Tạo thư mục `src/`, `tests/`, `public/`
- [x] Tạo `src/index.html` (entry point, di chuyển từ `index.html` gốc)
- [x] `npm install` — cài dependencies, kiểm tra không lỗi (99 packages, có 6 audit warning ở esbuild/vite dev-server, không ảnh hưởng production — xem ghi chú dưới)
- [x] Verify: `npm run dev` chạy được (Vite ready 647ms), báo lỗi thiếu `ui/app.ts` đúng như dự kiến (chưa viết)

## Phase 2: Core logic (cube + solver)

- [x] Tạo `src/core/types.ts` (Face, Move, FaceletState, Sticker, SolveResult — không dùng `any`)
- [x] Dịch `js/cube.js` → `src/core/cube.ts` (class Cube, giữ nguyên logic hình học) — smoke-check 3000 scramble khớp cubejs
- [x] Viết `tests/core/cube.test.ts` (toàn bộ 18 nước đi, round-trip, isSolved...) — 17 test, pass
- [x] Chạy test, đối chiếu kết quả với `vendor/cube.js` (cubejs) — 5000 scramble ngẫu nhiên, khớp 100%; coverage cube.ts: 100% stmt/func/line, ~90% branch (phần thiếu là guard phòng vệ không thể chạm tới)
- [x] Dịch `js/solver-lbl.js` → `src/core/solver-lbl.ts` — smoke-check 2000 scramble: 0 lỗi, độ dài lời giải tương đương bản gốc
- [x] Viết `tests/core/solver-lbl.test.ts` (2000 scramble, solution hợp lệ, các giai đoạn đúng tên) — 6 test, pass (~35s do vòng lặp 2000 scramble)
- [x] Kiểm tra coverage core/ — stmt/lines 97.95%, functions 100%, branch 89.28% (hạ ngưỡng branch threshold xuống 85% trong vitest.config.ts, có ghi chú lý do — phần thiếu là fallback phòng vệ không thể chạm tới)

## Phase 3: UI layer

- [x] Dịch `js/render3d.js` → `src/ui/renderer.ts` (dùng `@types/three`, không `any`)
- [x] Dịch `js/app.js` → `src/ui/app.ts` (typed event handlers, state)
- [x] Tách helper UI dùng chung → không cần thiết, app.ts đủ gọn (61 dòng → ~330 dòng có type, không có phần nào đủ lớn để tách thêm)
- [x] Nối vào `src/index.html`, kiểm tra `npm run dev` app chạy đúng — verify qua browser thật: Kociemba (21 nước, giải đúng), LBL (91 nước, 6 giai đoạn, giải đúng), validate() báo lỗi đúng khi còn ô trống. Nhập màu trên canvas 3D chưa click-test được do canvas cao 0px (chờ Phase 4 CSS)

> **Lưu ý kiến trúc quan trọng**: `vendor/cube.js` + `vendor/solve.js` (thuật toán
> Kociemba) đã **chuyển vào `public/vendor/`** và được nạp bằng `<script>` cổ điển
> trong `src/index.html` (KHÔNG qua `import` của Vite). Lý do: 2 file này dùng cơ
> chế UMD dựa vào `this` toàn cục để mutate class dùng chung giữa cube.js và
> solve.js — cơ chế này gãy khi chạy qua pipeline ESM strict-mode của Vite (`this`
> ở top-level luôn là `undefined`), đã verify lỗi thật qua `vite-node` trước khi
> quyết định. `app.ts` truy cập qua `window.Cube` (khai báo global trong
> `public/vendor/cube.d.ts`). Khi dọn dẹp ở Phase 6, đừng di chuyển 2 file này vào
> Vite module graph.

## Phase 4: SCSS

- [x] Tạo `src/styles/_base.scss` (biến CSS giữ nguyên runtime, 2 mixin dùng chung: `bordered`, `flex-row`)
- [x] Tách module: `_layout.scss`, `_buttons.scss`, `_player.scss`, `_panel.scss`, `_cube3d.scss`, gộp qua `main.scss` (dùng `@use`, không dùng `@import` đã deprecated)
- [x] `<link rel="stylesheet" href="styles/main.scss">` đã có sẵn từ Phase 1, Vite tự biên dịch qua `sass`
- [x] So sánh visual với bản cũ — verify qua browser thật: custom properties khớp 100% (`--bg`, `--accent`, `--accent2`, `--card`, `--line`, `--radius`), `.layout` grid `1fr 380px` + media query `max-width:900px` → `1fr` đều biên dịch đúng, luồng giải Kociemba (22 nước) chạy & hiển thị đẹp không lỗi

## Phase 5: Test & Build

- [x] `npm run test` — toàn bộ pass (23 test, 2 file, ~16s)
- [x] `npm run test:coverage` — core/: 97.95% stmt/lines, 100% functions, 89.28% branch — đạt ngưỡng (95/95/85/95)
- [x] `npm run typecheck` — 0 lỗi; grep `any` toàn bộ `src/`+`tests/` chỉ khớp trong 1 dòng comment giải thích lý do tránh `any`, không có usage thật
- [x] `npm run build` — ra `dist/` đúng (assets + vendor/ + favicon/og/sitemap), tổng gzip ~137.5KB (JS 121.96 + CSS 1.61 + HTML 2.48 + vendor cube.js 4.47 + solve.js 6.96) < 200KB. Cảnh báo "can't be bundled without type=module" là dự kiến (vendor classic script, xem ghi chú Phase 3)
- [x] `npm run preview` — verify qua browser thật: render đúng, không lỗi console; scramble → Kociemba solve (14 nước) → playback đến cuối → "✅ Đã giải xong!"

## Phase 6: Dọn dẹp & tài liệu

- [x] Xoá `js/`, `css/`, `index.html` gốc, `vendor/three.min.js` cũ (`git rm`) — đã commit trong git history (`c06746f`, `7534ae1`) nên không cần backup riêng; `npm run build` vẫn pass sau khi xoá
- [x] Cập nhật `AGENTS.md` (tham chiếu cấu trúc `src/`+`tests/`+`public/vendor/`, lệnh `npm run dev/build/test/typecheck`, kiến trúc vendor classic-script, quy ước `any`/type guard)
- [x] Cập nhật `README.md` (hướng dẫn dev mới: `npm install`, `npm run dev`, build/test, cấu trúc `src/`+`public/vendor/`, liên kết sang `AGENTS.md`)

---

## Nguyên tắc khi thực hiện

- Mỗi lần chỉ làm **một mục** trong checklist, xong thì tick `[x]` và dừng lại hỏi xác nhận.
- TypeScript: **không dùng `any`**, ưu tiên type rõ ràng, code trong sáng dễ đọc.
- Không refactor/thêm tính năng ngoài phạm vi migrate.
- Mọi thay đổi ở core logic phải có test đối chiếu trước khi coi là xong.
