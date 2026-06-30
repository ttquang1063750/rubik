/**
 * Lõi mô hình Rubik 3x3.
 *
 * - Trạng thái: mảng 54 phần tử thuộc Face (U,R,F,D,L,B), thứ tự facelet
 *   chuẩn URFDLB, mỗi mặt 9 ô đánh số 0..8 theo hàng.
 * - Bảng hoán vị cho 18 nước đi (U U' U2 R ...) được SINH TỰ ĐỘNG từ hình học
 *   của khối, rồi đối chiếu với cubejs (xem tests/) để chắc chắn đúng quy ước.
 * - Đồng thời cung cấp toạ độ 3D + pháp tuyến của từng facelet để dựng khối 3D.
 */
import { isMove } from './types';
import type {
  Axis,
  Face,
  FaceletState,
  Move,
  MoveDefinition,
  PermutationTable,
  Sticker,
  Vec3
} from './types';

const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_OFFSET: Readonly<Record<Face, number>> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

// ---- Hình học: toạ độ cubie + pháp tuyến cho mỗi facelet ----

/** r = hàng (0 trên), c = cột (0 trái) theo bố cục net chuẩn. */
function faceletGeometry(face: Face, idx: number): { pos: Vec3; n: Vec3 } {
  const r = Math.floor(idx / 3);
  const c = idx % 3;
  switch (face) {
    case 'U': return { pos: [c - 1, 1, r - 1], n: [0, 1, 0] };
    case 'R': return { pos: [1, 1 - r, 1 - c], n: [1, 0, 0] };
    case 'F': return { pos: [c - 1, 1 - r, 1], n: [0, 0, 1] };
    case 'D': return { pos: [c - 1, -1, 1 - r], n: [0, -1, 0] };
    case 'L': return { pos: [-1, 1 - r, c - 1], n: [-1, 0, 0] };
    case 'B': return { pos: [1 - c, 1 - r, -1], n: [0, 0, -1] };
  }
}

function buildStickers(): Sticker[] {
  const stickers: Sticker[] = [];
  for (const face of FACES) {
    for (let i = 0; i < 9; i++) {
      const { pos, n } = faceletGeometry(face, i);
      const center: Vec3 = [pos[0] + 0.5 * n[0], pos[1] + 0.5 * n[1], pos[2] + 0.5 * n[2]];
      stickers.push({ index: FACE_OFFSET[face] + i, face, faceIdx: i, pos, n, center });
    }
  }
  return stickers;
}

const STICKERS: readonly Sticker[] = buildStickers();

// ---- Sinh bảng hoán vị cho 18 nước đi từ hình học ----

function rotatePoint(p: Vec3, axis: Axis, deg: number): Vec3 {
  const a = (deg * Math.PI) / 180;
  const ca = Math.round(Math.cos(a));
  const sa = Math.round(Math.sin(a));
  const [x, y, z] = p;
  if (axis === 'x') return [x, y * ca - z * sa, y * sa + z * ca];
  if (axis === 'y') return [x * ca + z * sa, y, -x * sa + z * ca];
  return [x * ca - y * sa, x * sa + y * ca, z];
}

const AXIS_INDEX: Readonly<Record<Axis, number>> = { x: 0, y: 1, z: 2 };

/** Sinh hoán vị cho 1 lượt xoay 90°: perm[dest] = src. */
function generatePerm(axis: Axis, layer: -1 | 1, deg: -90 | 90): number[] {
  const ai = AXIS_INDEX[axis];
  const perm: number[] = STICKERS.map((_, i) => i);
  for (const sticker of STICKERS) {
    if (sticker.pos[ai] !== layer) continue;
    const nc = rotatePoint(sticker.center, axis, deg);
    const target = STICKERS.find((t) =>
      Math.abs(t.center[0] - nc[0]) < 1e-6 &&
      Math.abs(t.center[1] - nc[1]) < 1e-6 &&
      Math.abs(t.center[2] - nc[2]) < 1e-6
    );
    if (!target) throw new Error(`Không tìm thấy facelet đích cho sticker ${sticker.index}`);
    perm[target.index] = sticker.index;
  }
  return perm;
}

/** Định nghĩa lớp xoay cho mỗi mặt cơ bản (chiều kim đồng hồ đã chốt qua kiểm thử). */
const MOVE_DEF: Readonly<Record<Face, MoveDefinition>> = {
  U: { axis: 'y', layer: 1, deg: -90 },
  D: { axis: 'y', layer: -1, deg: 90 },
  R: { axis: 'x', layer: 1, deg: -90 },
  L: { axis: 'x', layer: -1, deg: 90 },
  F: { axis: 'z', layer: 1, deg: -90 },
  B: { axis: 'z', layer: -1, deg: 90 }
};

function invertPerm(perm: readonly number[]): number[] {
  const inv: number[] = new Array(perm.length);
  perm.forEach((src, dest) => { inv[src] = dest; });
  return inv;
}

/** (a rồi b): áp a trước rồi b. composed[dest] = a[b[dest]]. */
function composePerm(a: readonly number[], b: readonly number[]): number[] {
  return b.map((src) => a[src]);
}

function buildPermutationTable(): PermutationTable {
  const table: Partial<Record<Move, readonly number[]>> = {};
  for (const face of FACES) {
    const def = MOVE_DEF[face];
    const clockwise = generatePerm(def.axis, def.layer, def.deg);
    table[face] = clockwise;
    table[`${face}'`] = invertPerm(clockwise);
    table[`${face}2`] = composePerm(clockwise, clockwise);
  }
  // Vòng lặp trên đã điền đủ 18 khoá (3 biến thể x 6 mặt) nên ép kiểu về bảng đầy đủ là an toàn.
  return table as PermutationTable;
}

const PERMS: PermutationTable = buildPermutationTable();

function applyPermutation(state: FaceletState, perm: readonly number[]): FaceletState {
  return perm.map((src) => state[src]);
}

function solvedState(): FaceletState {
  const state: Face[] = [];
  for (const face of FACES) {
    for (let i = 0; i < 9; i++) state.push(face);
  }
  return state;
}

// ---- Tiện ích thao tác chuỗi nước đi ----

export function parseMoves(seq: Move[] | string): Move[] {
  if (Array.isArray(seq)) return seq;
  const trimmed = seq.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map((token) => {
    if (!isMove(token)) throw new Error(`Nước không hợp lệ: ${token}`);
    return token;
  });
}

const AMOUNT: Readonly<Record<string, 1 | 2 | 3>> = { '': 1, '2': 2, "'": 3 };
const AMOUNT_SUFFIX: Readonly<Record<number, string>> = { 1: '', 2: '2', 3: "'" };

/** Rút gọn chuỗi nước: gộp các nước cùng mặt liền nhau (U U -> U2, U U' -> bỏ...). */
export function simplify(seq: Move[] | string): Move[] {
  let moves = parseMoves(seq);
  let changed = true;
  while (changed) {
    changed = false;
    const out: Move[] = [];
    for (const move of moves) {
      const last = out[out.length - 1];
      if (last && last[0] === move[0]) {
        out.pop();
        const amount = ((AMOUNT[last.slice(1)] ?? 0) + (AMOUNT[move.slice(1)] ?? 0)) % 4;
        if (amount !== 0) {
          const merged = `${last[0]}${AMOUNT_SUFFIX[amount] ?? ''}`;
          if (!isMove(merged)) throw new Error(`Lỗi rút gọn nước đi: ${merged}`);
          out.push(merged);
        }
        changed = true;
      } else {
        out.push(move);
      }
    }
    moves = out;
  }
  return moves;
}

function invertMove(move: Move): Move {
  if (move.length === 1) {
    const inverted = `${move}'`;
    if (!isMove(inverted)) throw new Error(`Lỗi đảo nước đi: ${move}`);
    return inverted;
  }
  if (move[1] === "'") {
    const base = move[0];
    if (!isMove(base)) throw new Error(`Lỗi đảo nước đi: ${move}`);
    return base;
  }
  return move; // dạng "X2": tự nghịch đảo
}

export function invertSeq(seq: Move[] | string): Move[] {
  return parseMoves(seq).slice().reverse().map(invertMove);
}

// ---- Cube API ----

export class Cube {
  static readonly FACES: readonly Face[] = FACES;
  static readonly OFFSET: Readonly<Record<Face, number>> = FACE_OFFSET;
  static readonly STICKERS: readonly Sticker[] = STICKERS;
  static readonly MOVE_DEF: Readonly<Record<Face, MoveDefinition>> = MOVE_DEF;
  static readonly PERMS: PermutationTable = PERMS;
  static readonly parseMoves = parseMoves;
  static readonly simplify = simplify;
  static readonly invertSeq = invertSeq;

  private _state: FaceletState;

  constructor(state?: FaceletState) {
    this._state = state ? state.slice() : solvedState();
  }

  static solved(): Cube {
    return new Cube();
  }

  /** Không copy: solver gọi rất nhiều lần trong vòng lặp tìm kiếm — đừng mutate trực tiếp. */
  get state(): FaceletState {
    return this._state;
  }

  clone(): Cube {
    return new Cube(this._state);
  }

  toString(): string {
    return this._state.join('');
  }

  isSolved(): boolean {
    for (let face = 0; face < 6; face++) {
      const base = face * 9;
      const center = this._state[base + 4];
      for (let i = 0; i < 9; i++) {
        if (this._state[base + i] !== center) return false;
      }
    }
    return true;
  }

  /** Áp 1 nước (vd "R", "U'", "F2"). */
  move(m: Move): this {
    this._state = applyPermutation(this._state, PERMS[m]);
    return this;
  }

  /** Áp 1 chuỗi nước "R U R' U'" hoặc mảng nước đã parse sẵn. */
  apply(seq: Move[] | string): this {
    for (const m of parseMoves(seq)) this.move(m);
    return this;
  }
}
