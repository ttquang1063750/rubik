# AGENTS.md

Hướng dẫn cho AI agent (và lập trình viên mới) khi làm việc trong repo này.

## Ứng dụng là gì

Web tĩnh (không build, không backend) cho phép **nhập màu một khối Rubik 3x3 trên mô hình 3D rồi xem cách giải**. Toàn bộ chạy phía trình duyệt, mở offline được.

Luồng người dùng:
1. Xoay khối 3D (kéo chuột) và **bấm vào từng ô để tô màu** theo khối thật. Ô tâm cố định, định nghĩa hệ màu.
2. Chọn cách giải: **Kociemba** (ngắn ~20 nước) hoặc **Người mới / từng tầng** (chia giai đoạn có tên).
3. Xem lời giải: từng bước, chạy tự động, "giải nhanh", danh sách toàn bộ nước đi (bấm nhảy tới).

## Chạy & kiểm thử

```bash
# Chạy app (cần web server tĩnh vì có nạp nhiều file .js)
cd rubik && python3 -m http.server 8000   # http://localhost:8000

# Kiểm thử lõi & bộ giải bằng Node (các module hỗ trợ cả CommonJS lẫn browser)
node -e "
  const Cube = require('./js/cube.js');
  const solve = require('./js/solver-lbl.js');
  // ... viết test scramble -> solve -> isSolved()
"
```

Không có test runner/CI. Khi sửa lõi hoặc bộ giải, **luôn chạy lại kiểm thử ngẫu nhiên hàng nghìn ca** (scramble → giải → phải `isSolved()`), đối chiếu engine với cubejs.

## Kiến trúc & file

| File | Vai trò |
|------|---------|
| `index.html` | Cấu trúc trang, nạp script theo thứ tự (xem dưới) |
| `css/styles.css` | Toàn bộ style (dark theme, biến CSS ở `:root`) |
| `js/cube.js` | **Lõi**: trạng thái 54 facelet, sinh bảng hoán vị 18 nước, `simplify`, geometry sticker |
| `js/render3d.js` | Three.js: dựng 26 cubie + 54 sticker, hoạt hoạ xoay lớp, raycast pick |
| `js/solver-lbl.js` | Bộ giải tầng-by-tầng (trả về các giai đoạn có tên) |
| `js/app.js` | UI: bảng màu, kiểm tra hợp lệ, gọi bộ giải, điều khiển phát lại |
| `vendor/three.min.js` | Three.js r160 (UMD, global `THREE`) |
| `vendor/cube.js`, `vendor/solve.js` | cubejs — thuật toán Kociemba (global `Cube`) |

**Thứ tự nạp script bắt buộc** (trong `index.html`): `three` → `vendor/cube` → `vendor/solve` → `js/cube` → `js/solver-lbl` → `js/render3d` → `js/app`.

### Globals (tránh trùng tên)
- `window.RubikCube` — lõi tự viết (file `js/cube.js`).
- `window.Cube` — cubejs (file `vendor/cube.js`). **Khác nhau, đừng nhầm.**
- `window.solveLBL`, `window.RubikRenderer` — bộ giải tầng & renderer.

## Quy ước & bất biến quan trọng

- **Trạng thái = mảng 54 ký tự** thuộc `{U,R,F,D,L,B}` theo thứ tự facelet chuẩn **URFDLB** (mỗi mặt 9 ô, đánh số 0–8 theo hàng). Ký tự là *mặt nhà* của ô, không phải tên màu. Đây cũng đúng định dạng `Cube.fromString` của cubejs ⇒ liên thông không cần chuyển đổi.
- **Ký tự '.'** = ô chưa tô (chỉ ở chế độ nhập); renderer tô xám. Không bao giờ truyền '.' vào nước đi/bộ giải.
- **Map màu hiển thị** ở `RubikRenderer.COLORS`: U=trắng, D=vàng, F=lá, B=dương, R=đỏ, L=cam. Nếu đổi, đổi ở một nơi này.
- **Nước đi**: 18 nước `{U,D,R,L,F,B}` × `{'', ', 2}`. Bảng hoán vị (`Cube.PERMS`) **sinh từ hình học** trong `js/cube.js`, KHÔNG hardcode — đã đối chiếu khớp 100% với cubejs trên 5000 scramble. Nếu sửa geometry, phải chạy lại đối chiếu.
- **Đồng bộ 3D ↔ logic**: hướng quay hình học trong `render3d.js` (`moveAngle` dùng `Cube.MOVE_DEF[face].deg`) phải khớp đúng bảng hoán vị engine. Renderer **luôn tô lại màu từ `state` sau mỗi nước** (vị trí mesh cố định, chỉ đổi màu); animation chỉ là hiệu ứng thị giác.
- **Center cố định**: chỉ số ô tâm `[4,13,22,31,40,49]` không cho người dùng sửa.
- **Kiểm tra hợp lệ** (`app.js validate`): đủ 54 ô, mỗi màu đúng 9, và dùng cubejs `fromString` để kiểm tra solvable (permutation hợp lệ, tổng định hướng góc %3, cạnh %2, cùng parity). Luôn validate trước khi gọi bộ giải để tránh treo.

## Bộ giải tầng-by-tầng (`solver-lbl.js`)

- Xây tầng đầu ở mặt **D (đáy)**, tầng cuối **U (đỉnh)** để khớp công thức last-layer chuẩn.
- Kỹ thuật: thập tự dùng **vi-tìm-kiếm nông**; góc tầng 1 & tầng giữa cắm bằng **công thức cố định** (được khám phá qua brute-force, không phải nhớ); tầng cuối dùng **macro-search nông** (U-align + công thức chuẩn) với mục tiêu rõ ràng ⇒ đúng theo cấu trúc.
- Trả về `{ stages: [{name, moves}], moves, solved }`. Mỗi giai đoạn đã `simplify`; giai đoạn rỗng bị lọc.
- **Đã test 2000+ scramble, 0 lỗi.** Đổi công thức/giai đoạn ⇒ chạy lại test bắt buộc.

## Khi chỉnh sửa

- Giữ **bình luận tiếng Việt** đồng bộ với code hiện có.
- Các module dùng wrapper UMD (chạy cả Node lẫn browser) — đừng phá để còn test bằng Node.
- Không thêm bước build/bundler; giữ "mở file là chạy".
- Đổi lõi nước đi / geometry / bộ giải ⇒ **bắt buộc** chạy lại đối chiếu cubejs + test scramble hàng loạt trước khi coi là xong.
