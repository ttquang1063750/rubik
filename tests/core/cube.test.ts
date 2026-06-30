import { describe, it, expect } from 'vitest';
import { Cube } from '../../src/core/cube';
import type { Face, Move } from '../../src/core/types';
import CubeJS from '../../public/vendor/cube';

const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const ALL_MOVES: readonly Move[] = FACES.flatMap((f) => [f, `${f}'`, `${f}2`] as Move[]);

function randomScramble(n: number): string {
  const mods = ['', "'", '2'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(FACES[(Math.random() * 6) | 0] + mods[(Math.random() * 3) | 0]);
  }
  return out.join(' ');
}

describe('Cube — trạng thái cơ bản', () => {
  it('trạng thái solved có đúng 9 ô mỗi màu', () => {
    const counts: Record<Face, number> = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
    for (const f of Cube.solved().state) counts[f]++;
    for (const f of FACES) expect(counts[f]).toBe(9);
  });

  it('trạng thái solved có tâm đúng mặt nhà', () => {
    const state = Cube.solved().state;
    FACES.forEach((f, i) => expect(state[i * 9 + 4]).toBe(f));
  });

  it('isSolved() đúng cho trạng thái solved và sai cho trạng thái đã xáo', () => {
    expect(Cube.solved().isSolved()).toBe(true);
    expect(new Cube().apply("R U R' U'").isSolved()).toBe(false);
  });

  it('clone() tạo bản sao độc lập', () => {
    const original = Cube.solved();
    const copy = original.clone();
    copy.move('R');
    expect(copy.isSolved()).toBe(false);
    expect(original.isSolved()).toBe(true);
  });

  it('toString() và dựng lại từ state cho cùng kết quả', () => {
    const cube = new Cube().apply(randomScramble(20));
    const rebuilt = new Cube(cube.state);
    expect(rebuilt.toString()).toBe(cube.toString());
  });
});

describe('Cube — nước đi', () => {
  it('lặp lại 1 nước đủ 4 lần (hoặc nước \' đủ 4 lần) quay về solved', () => {
    for (const face of FACES) {
      const cube = Cube.solved();
      for (let i = 0; i < 4; i++) cube.move(face);
      expect(cube.isSolved()).toBe(true);
    }
  });

  it('nước "X2" tương đương áp "X" hai lần', () => {
    for (const face of FACES) {
      const double = new Cube().move(`${face}2` as Move);
      const twice = new Cube().move(face).move(face);
      expect(double.toString()).toBe(twice.toString());
    }
  });

  it('nước và nghịch đảo của nó triệt tiêu lẫn nhau', () => {
    for (const move of ALL_MOVES) {
      const cube = new Cube().move(move).apply(Cube.invertSeq([move]));
      expect(cube.isSolved()).toBe(true);
    }
  });

  it('apply(chuỗi) cho kết quả giống áp từng nước một', () => {
    const seq = randomScramble(30);
    const viaApply = new Cube().apply(seq).toString();
    const viaMoves = Cube.parseMoves(seq).reduce((c, m) => c.move(m), new Cube());
    expect(viaApply).toBe(viaMoves.toString());
  });

  it('apply(scramble) rồi apply(invertSeq(scramble)) quay về solved — 500 lần ngẫu nhiên', () => {
    for (let i = 0; i < 500; i++) {
      const seq = randomScramble(25);
      const cube = new Cube().apply(seq).apply(Cube.invertSeq(seq));
      expect(cube.isSolved()).toBe(true);
    }
  });

  it('move() báo lỗi rõ ràng với nước không hợp lệ', () => {
    expect(() => Cube.parseMoves('X')).toThrow();
    expect(() => Cube.parseMoves('R X')).toThrow();
  });
});

describe('Cube — simplify / invertSeq', () => {
  it('simplify gộp nước cùng mặt liền nhau', () => {
    expect(Cube.simplify("U U U'")).toEqual(['U']);
    expect(Cube.simplify('R R')).toEqual(['R2']);
    expect(Cube.simplify("R R'")).toEqual([]);
    expect(Cube.simplify('R R2')).toEqual(["R'"]);
  });

  it('simplify không đổi chuỗi không có gì để gộp', () => {
    expect(Cube.simplify("R U R' U'")).toEqual(['R', 'U', "R'", "U'"]);
  });

  it('invertSeq đảo thứ tự và nghịch đảo từng nước', () => {
    expect(Cube.invertSeq('R U2')).toEqual(['U2', "R'"]);
    expect(Cube.invertSeq("R' U F2")).toEqual(['F2', "U'", 'R']);
  });

  it('simplify(seq) cho cùng trạng thái như seq gốc', () => {
    const seq = randomScramble(30);
    const a = new Cube().apply(seq).toString();
    const b = new Cube().apply(Cube.simplify(seq)).toString();
    expect(a).toBe(b);
  });
});

describe('Cube <-> cubejs (đối chiếu)', () => {
  it('mỗi nước trong 18 nước cho kết quả giống cubejs', () => {
    for (const move of ALL_MOVES) {
      const mine = new Cube().move(move).toString();
      const ref = new CubeJS().move(move).asString();
      expect(mine).toBe(ref);
    }
  });

  it('5000 scramble ngẫu nhiên cho kết quả giống cubejs', () => {
    for (let i = 0; i < 5000; i++) {
      const seq = randomScramble(25);
      const mine = new Cube().apply(seq).toString();
      const ref = new CubeJS().move(seq).asString();
      expect(mine).toBe(ref);
    }
  });
});
