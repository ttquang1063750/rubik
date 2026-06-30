# AGENTS.md

Hướng dẫn cho AI agent (và lập trình viên mới) khi làm việc trong repo này.

## Ứng dụng là gì

Web tĩnh (build qua Vite, chạy hoàn toàn phía trình duyệt, không backend) cho phép **nhập màu một khối Rubik 3x3 trên mô hình 3D rồi xem cách giải**.

Luồng người dùng:
1. Xoay khối 3D (kéo chuột) và **bấm vào từng ô để tô màu** theo khối thật. Ô tâm cố định, định nghĩa hệ màu.
2. Chọn cách giải: **Kociemba** (ngắn ~20 nước) hoặc **Người mới / từng tầng** (chia giai đoạn có tên).
3. Xem lời giải: từng bước, chạy tự động, "giải nhanh", danh sách toàn bộ nước đi (bấm nhảy tới).

## Chạy & kiểm thử

```bash
npm install

npm run dev             # dev server (Vite, http://localhost:5173)
npm run build            # build production ra dist/
npm run preview          # chạy thử bản build

npm run test             # chạy toàn bộ test (Vitest)
npm run test:coverage    # test + coverage report (core/ ≥ 95% lines/functions/statements, ≥ 85% branch)
npm run typecheck        # tsc --noEmit, kiểm tra type strict, không `any`
```

Khi sửa lõi (`src/core/cube.ts`, `src/core/solver-lbl.ts`), **luôn chạy lại `npm run test`** — bộ test đối chiếu hàng nghìn scramble ngẫu nhiên với cubejs (`tests/core/cube.test.ts`) và verify `solveLBL` luôn giải về `solved` (`tests/core/solver-lbl.test.ts`).

## Kiến trúc & file

| File/thư mục | Vai trò |
|------|---------|
| `src/index.html` | Entry point Vite, nạp script theo thứ tự (xem dưới) |
| `src/styles/*.scss` | SCSS modular (`@use`): `_base`, `_layout`, `_cube3d`, `_panel`, `_buttons`, `_player`, gộp qua `main.scss` |
| `src/core/types.ts` | Type dùng chung: `Face`, `Move` (template literal type), `FaceletState`, `Sticker`, `SolveResult`... |
| `src/core/cube.ts` | **Lõi**: class `Cube` — trạng thái 54 facelet, bảng hoán vị 18 nước sinh từ hình học, `simplify`, sticker geometry |
| `src/core/solver-lbl.ts` | Bộ giải tầng-by-tầng, hàm `solveLBL(state)` trả về các giai đoạn có tên |
| `src/ui/renderer.ts` | Three.js (npm package `three`): class `RubikRenderer` — dựng 26 cubie + 54 sticker, hoạt hoạ xoay lớp, xoay camera tự do, raycast pick |
| `src/ui/app.ts` | UI: bảng màu, kiểm tra hợp lệ, gọi bộ giải, điều khiển phát lại |
| `public/vendor/cube.js`, `public/vendor/solve.js` | cubejs — thuật toán Kociemba (global `window.Cube`) |
| `public/vendor/cube.d.ts` | Khai báo type cho cubejs (export `CubeJS` dùng trong test + `declare global Window.Cube`) |
| `tests/core/*.test.ts` | Vitest: đối chiếu `Cube` với cubejs, verify `solveLBL` trên scramble hàng loạt |

**Thứ tự nạp script bắt buộc** (trong `src/index.html`): `vendor/cube.js` → `vendor/solve.js` (script cổ điển, KHÔNG qua Vite module graph) → `type="module" src="ui/app.ts"` (import `three`, `core/*`, `ui/renderer.ts` qua ESM bình thường).

> **Vì sao `public/vendor/cube.js` + `solve.js` không phải file TS/ESM**: 2 file này dùng cơ chế UMD dựa vào `this` toàn cục để mutate class dùng chung giữa `cube.js` và `solve.js`. Cơ chế này gãy khi chạy qua pipeline ESM strict-mode của Vite (`this` ở top-level luôn là `undefined`, đã verify lỗi thật qua `vite-node`). Giải pháp: giữ nguyên 2 file, đặt trong `public/vendor/` để Vite copy thẳng (không build), nạp bằng thẻ `<script>` cổ điển trong `index.html`, và `app.ts` truy cập qua `window.Cube` (type qua `declare global` trong `cube.d.ts`). **Khi sửa kiến trúc, đừng cố đưa 2 file này vào `import` của Vite.**

### Globals (tránh trùng tên)

- `window.Cube` — cubejs (`public/vendor/cube.js`), chỉ dùng trong `app.ts` cho thuật toán Kociemba.
- Mọi thứ khác (`Cube` lõi tự viết, `solveLBL`, `RubikRenderer`) là **module ESM thường** (`import`/`export`), không gắn lên `window`.

## Quy ước & bất biến quan trọng

- **TypeScript strict, không dùng `any`** ở bất kỳ đâu trong `src/`/`tests/` (kể cả ép kiểu). Dùng type guard (`isMove`, `isFace`, `isSide`) thay vì `as` khi có thể; nếu bắt buộc `as`, phải có comment giải thích bất biến đảm bảo an toàn.
- **Trạng thái = mảng 54 ký tự** thuộc `{U,R,F,D,L,B}` theo thứ tự facelet chuẩn **URFDLB** (mỗi mặt 9 ô, đánh số 0–8 theo hàng). Ký tự là *mặt nhà* của ô, không phải tên màu. Đây cũng đúng định dạng `Cube.fromString` của cubejs ⇒ liên thông không cần chuyển đổi.
- **Ký tự '.'** (`DisplayCell` trong `renderer.ts`) = ô chưa tô (chỉ ở chế độ nhập); renderer tô xám. Không bao giờ truyền '.' vào nước đi/bộ giải (`assertFaceletState` ném lỗi nếu còn '.').
- **Map màu hiển thị** ở `RubikRenderer.COLORS`: U=trắng, D=vàng, F=lá, B=dương, R=đỏ, L=cam. Nếu đổi, đổi ở một nơi này.
- **Nước đi**: 18 nước `{U,D,R,L,F,B}` × `{'', ', 2}` (type `Move` là template literal type). Bảng hoán vị (`Cube.PERMS`) **sinh từ hình học** trong `cube.ts`, KHÔNG hardcode — đã đối chiếu khớp 100% với cubejs trên 5000 scramble (test trong `tests/core/cube.test.ts`). Nếu sửa geometry, phải chạy lại đối chiếu (`npm run test`).
- **Đồng bộ 3D ↔ logic**: hướng quay hình học trong `renderer.ts` (`moveAngle` dùng `Cube.MOVE_DEF[face].deg`) phải khớp đúng bảng hoán vị engine. Renderer **luôn tô lại màu từ `state` sau mỗi nước** (vị trí mesh cố định, chỉ đổi màu); animation chỉ là hiệu ứng thị giác.
- **Camera xoay tự do** (`renderer.ts`, `bindInput`): dùng quaternion gia tăng theo trục hiện tại của camera (lấy lại mỗi lần kéo), KHÔNG dùng góc tuyệt đối kiểu toạ độ cầu (sẽ có cực gây kẹt xoay). Không clamp góc — xoay được vô hạn vòng theo mọi hướng.
- **Center cố định**: chỉ số ô tâm `[4,13,22,31,40,49]` không cho người dùng sửa.
- **Kiểm tra hợp lệ** (`app.ts`): đủ 54 ô, mỗi màu đúng 9, và dùng cubejs `fromString` để kiểm tra solvable (permutation hợp lệ, tổng định hướng góc %3, cạnh %2, cùng parity). Luôn validate trước khi gọi bộ giải để tránh treo.

## Bộ giải tầng-by-tầng (`solver-lbl.ts`)

- Xây tầng đầu ở mặt **D (đáy)**, tầng cuối **U (đỉnh)** để khớp công thức last-layer chuẩn.
- Kỹ thuật: thập tự dùng **vi-tìm-kiếm nông**; góc tầng 1 & tầng giữa cắm bằng **công thức cố định** (được khám phá qua brute-force, không phải nhớ); tầng cuối dùng **macro-search nông** (U-align + công thức chuẩn) với mục tiêu rõ ràng ⇒ đúng theo cấu trúc.
- Trả về `SolveResult { stages: [{name, moves}], moves, solved }`. Mỗi giai đoạn đã `simplify`; giai đoạn rỗng bị lọc.
- **Đã test 2000+ scramble, 0 lỗi** (`tests/core/solver-lbl.test.ts`, ~35s do số lượng scramble lớn). Đổi công thức/giai đoạn ⇒ chạy lại test bắt buộc.
- Gặp trạng thái cấu trúc bất khả thi thì **ném lỗi rõ ràng**, không fallback âm thầm.

## Khi chỉnh sửa

- Giữ **bình luận tiếng Việt** đồng bộ với code hiện có, chỉ viết khi giải thích *vì sao* (bất biến ẩn, workaround), không lặp lại điều code đã rõ.
- **Không dùng `any`** — đây là yêu cầu cứng, kiểm tra lại bằng `npm run typecheck` + `grep -rn "\bany\b" src tests` trước khi coi một thay đổi là xong.
- Đổi lõi nước đi / geometry / bộ giải ⇒ **bắt buộc** `npm run test` (đối chiếu cubejs + scramble hàng loạt) trước khi coi là xong.
- Đổi UI/SCSS ⇒ verify qua `npm run dev` + browser thật (xem [PLAN.md](PLAN.md) phần "Verification Plan").
- Không thêm bước build/bundler khác ngoài Vite đã thiết lập.
