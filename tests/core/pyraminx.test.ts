import { describe, expect, it } from 'vitest';
import { Pyraminx, solvePyraminx } from '../../src/core/pyraminx-solver';

describe('Pyraminx Core & Solver', () => {
  it('phải tạo được trạng thái solved và có đúng 36 ô màu', () => {
    const p = Pyraminx.solved();
    expect(p.state.length).toBe(36);
    // 4 mặt, mỗi mặt đúng 9 ô đồng màu
    const counts = p.state.reduce((acc, c) => {
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(counts['R']).toBe(9); // F
    expect(counts['G']).toBe(9); // L
    expect(counts['Y']).toBe(9); // R
    expect(counts['B']).toBe(9); // D
  });

  it('phải áp dụng nước đi và giải ngược lại đúng trạng thái solved', () => {
    const p = Pyraminx.solved();
    // Xoay nước đi U rồi xoay U' phải về solved
    const p2 = p.move('U').move("U'");
    expect(p2.state).toEqual(p.state);

    // Xoay nước đi L rồi xoay L'
    const p3 = p.move('L').move("L'");
    expect(p3.state).toEqual(p.state);

    // Xoay chóp nhỏ u rồi u'
    const p4 = p.move('u').move("u'");
    expect(p4.state).toEqual(p.state);
  });

  it('phải giải thành công 500 scramble ngẫu nhiên về solved', () => {
    const allowedMoves = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
    const tips = ['u', "u'", 'l', "l'", 'r', "r'", 'b', "b'"];

    for (let i = 0; i < 500; i++) {
      let p = Pyraminx.solved();
      const numMoves = 10 + Math.floor(Math.random() * 8); // 10-17 nước
      const scrambleMoves: string[] = [];

      let last = '';
      for (let j = 0; j < numMoves; j++) {
        let m = allowedMoves[Math.floor(Math.random() * allowedMoves.length)];
        while (m[0] === last) {
          m = allowedMoves[Math.floor(Math.random() * allowedMoves.length)];
        }
        p = p.move(m as any);
        scrambleMoves.push(m);
        last = m[0];
      }

      // Thêm chóp ngẫu nhiên
      tips.forEach((t) => {
        if (Math.random() < 0.5) {
          p = p.move(t as any);
          scrambleMoves.push(t);
        }
      });

      const res = solvePyraminx(p.state);
      expect(res.solved).toBe(true);
      expect(res.moves.length).toBeLessThanOrEqual(25); // Lời giải Pyraminx rất ngắn
    }
  });
});
