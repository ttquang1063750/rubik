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

## Chạy
Mở bằng một web server tĩnh bất kỳ (vì có nạp file `.js`):

```bash
cd rubik
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

## Cấu trúc
| File | Vai trò |
|------|---------|
| `index.html`, `css/styles.css` | Giao diện |
| `js/cube.js` | Lõi mô hình khối + bảng hoán vị nước đi (sinh từ hình học, đối chiếu khớp 100% với cubejs) |
| `js/render3d.js` | Dựng & hoạt hoạ khối 3D bằng Three.js |
| `js/solver-lbl.js` | Bộ giải tầng-by-tầng (đã test 2000+ ca ngẫu nhiên, 0 lỗi) |
| `js/app.js` | Kết nối UI, kiểm tra hợp lệ, phát lại |
| `vendor/` | Three.js (3D) và cubejs (thuật toán Kociemba) — tải sẵn để chạy offline |
