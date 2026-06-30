import { describe, it, expect } from 'vitest';
import { Cube } from '../../src/core/cube';
import { solveLBL } from '../../src/core/solver-lbl';
import { isMove } from '../../src/core/types';

function randomScramble(n: number): string {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  const mods = ['', "'", '2'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(faces[(Math.random() * 6) | 0] + mods[(Math.random() * 3) | 0]);
  }
  return out.join(' ');
}

describe('solveLBL — trường hợp cơ bản', () => {
  it('khối đã giải sẵn trả về rỗng, solved=true', () => {
    const result = solveLBL(Cube.solved().state);
    expect(result.stages).toEqual([]);
    expect(result.moves).toEqual([]);
    expect(result.solved).toBe(true);
  });
});

describe('solveLBL — giải đúng trên diện rộng', () => {
  it('2000 scramble ngẫu nhiên đều giải về solved', () => {
    for (let i = 0; i < 2000; i++) {
      const scramble = randomScramble(25);
      const scrambled = new Cube().apply(scramble);
      const result = solveLBL(scrambled.state);

      expect(result.solved).toBe(true);
      const check = new Cube().apply(scramble).apply(result.moves);
      expect(check.isSolved()).toBe(true);
    }
  }, 30_000);
});

describe('solveLBL — hình dạng kết quả', () => {
  it('mọi nước trong lời giải là 1 trong 18 nước hợp lệ', () => {
    const scrambled = new Cube().apply(randomScramble(25));
    const result = solveLBL(scrambled.state);
    for (const m of result.moves) expect(isMove(m)).toBe(true);
  });

  it('độ dài lời giải hợp lý (< 200 nước) trên nhiều mẫu', () => {
    for (let i = 0; i < 100; i++) {
      const scrambled = new Cube().apply(randomScramble(25));
      const result = solveLBL(scrambled.state);
      expect(result.moves.length).toBeLessThan(200);
    }
  });

  it('các giai đoạn có tên khác rỗng và không có giai đoạn nào trống', () => {
    const scrambled = new Cube().apply(randomScramble(25));
    const result = solveLBL(scrambled.state);
    expect(result.stages.length).toBeGreaterThan(0);
    for (const stage of result.stages) {
      expect(stage.name.length).toBeGreaterThan(0);
      expect(stage.moves.length).toBeGreaterThan(0);
    }
  });

  it('tổng nước của các giai đoạn bằng đúng moves gộp lại', () => {
    const scrambled = new Cube().apply(randomScramble(25));
    const result = solveLBL(scrambled.state);
    const concatenated = result.stages.flatMap((stage) => stage.moves);
    expect(concatenated).toEqual(result.moves);
  });
});
