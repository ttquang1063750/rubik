// Khai báo type tối thiểu cho cubejs (cube.js + solve.js — thư viện Kociemba).
// Hai file này được nạp bằng <script> cổ điển trong index.html (không qua Vite
// bundler) vì chúng dùng cơ chế UMD dựa vào `this` toàn cục, không tương thích
// với pipeline ESM strict-mode. Vì vậy interface dưới đây phục vụ 2 cách dùng:
//   - import mặc định: chỉ dùng trong test (tests/core/cube.test.ts) để đối
//     chiếu move()/asString() với engine của dự án.
//   - global window.Cube: dùng trong src/ui/app.ts cho thuật toán Kociemba.
declare class CubeJS {
  constructor(state?: unknown);
  readonly cp: number[];
  readonly ep: number[];
  readonly co: number[];
  readonly eo: number[];
  move(seq: string): this;
  asString(): string;
  solve(): string;
  static fromString(s: string): CubeJS;
  static initSolver(): void;
}

declare global {
  interface Window {
    Cube: typeof CubeJS;
  }
}

export default CubeJS;
