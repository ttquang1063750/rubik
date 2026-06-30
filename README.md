# 🧩 Rubik Solver

Trang web nhập màu khối Rubik 3x3 và xem cách giải — khối 3D xoay được, bấm từng ô để tô màu như đang cầm khối thật.

## Tính năng
- **Nhập màu trên khối 3D**: kéo để xoay, chọn màu rồi chạm vào từng ô (ô tâm cố định).
- **Kiểm tra hợp lệ**: báo lỗi nếu thiếu ô, sai số lượng màu, hoặc trạng thái không thể giải được.
- **Hai cách giải**:
  - **Kociemba** — lời giải ngắn (~20 nước).
  - **Người mới (từng tầng)** — chia giai đoạn có tên (thập tự đáy → góc tầng 1 → tầng giữa → tầng cuối), dễ học.
- **Xem giải linh hoạt**: từng bước (◀ ▶), chạy tự động, "giải nhanh ⏩", tới đầu/cuối, chỉnh tốc độ, và danh sách toàn bộ nước đi (bấm vào một nước để nhảy tới đó).
- Có nút **Trộn ngẫu nhiên** để thử nhanh.

## Phát triển

```bash
npm install
npm run dev       # http://localhost:5173, hot reload
```

## Build & kiểm thử

```bash
npm run build           # build production ra dist/
npm run preview         # chạy thử bản build

npm run test             # chạy test (Vitest)
npm run test:coverage    # test + coverage report
npm run typecheck        # kiểm tra TypeScript strict
```

## Cấu trúc
| File/thư mục | Vai trò |
|------|---------|
| `src/index.html`, `src/styles/*.scss` | Giao diện |
| `src/core/cube.ts` | Lõi mô hình khối + bảng hoán vị nước đi (sinh từ hình học, đối chiếu khớp 100% với cubejs) |
| `src/ui/renderer.ts` | Dựng & hoạt hoạ khối 3D bằng Three.js |
| `src/core/solver-lbl.ts` | Bộ giải tầng-by-tầng (đã test 2000+ ca ngẫu nhiên, 0 lỗi) |
| `src/ui/app.ts` | Kết nối UI, kiểm tra hợp lệ, phát lại |
| `public/vendor/` | cubejs (thuật toán Kociemba) — nạp bằng script cổ điển, xem [AGENTS.md](AGENTS.md) |
| `tests/core/` | Test Vitest cho lõi + bộ giải |

Chi tiết kiến trúc & quy ước code: xem [AGENTS.md](AGENTS.md).
