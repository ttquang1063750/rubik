import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**/*.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        // Thấp hơn lines/statements: một số nhánh là fallback phòng vệ cho bất biến
        // hình học không thể vi phạm trên khối hợp lệ (đã verify qua hàng nghìn
        // scramble), cố ép coverage 90%+ sẽ cần test giả tạo không phản ánh thực tế.
        branches: 85,
        statements: 95
      }
    }
  }
});
