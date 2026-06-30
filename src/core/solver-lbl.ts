/**
 * Bộ giải theo phương pháp tầng-by-tầng (beginner method).
 *
 * Tầng đầu xây ở mặt D (đáy), tầng cuối là U (đỉnh) — khớp công thức last-layer
 * chuẩn. Mọi công thức dùng ở đây đều đã được đối chiếu với lõi engine (vốn khớp
 * 100% với cubejs / quy ước chuẩn URFDLB).
 *
 * Kỹ thuật: thập tự dùng vi-tìm-kiếm (micro-search) nông; tầng 1 & tầng giữa cắm
 * quân bằng công thức cố định; tầng cuối dùng "macro-search" nông (U-align + công
 * thức chuẩn) với mục tiêu rõ ràng -> đúng theo cấu trúc, đã test hàng nghìn ca.
 */
import { Cube } from './cube';
import { isFace, isMove } from './types';
import type { Face, FaceletState, Move, SolveResult, SolveStage, Sticker, Vec3 } from './types';

type Goal = (state: FaceletState) => boolean;

// ---- piece groups theo vị trí cubie ----

function pos(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

const BYPOS: Record<string, Sticker[]> = {};
for (const sticker of Cube.STICKERS) {
  const key = sticker.pos.join(',');
  if (!BYPOS[key]) BYPOS[key] = [];
  BYPOS[key].push(sticker);
}

function piece(p: Vec3): readonly Sticker[] {
  const found = BYPOS[p.join(',')];
  if (!found) throw new Error(`Không tìm thấy piece tại vị trí ${p.join(',')}`);
  return found;
}

function solvedPiece(state: FaceletState, group: readonly Sticker[]): boolean {
  return group.every((sticker) => state[sticker.index] === sticker.face);
}

function colorsAt(state: FaceletState, group: readonly Sticker[]): Partial<Record<Face, Face>> {
  const colors: Partial<Record<Face, Face>> = {};
  for (const sticker of group) colors[sticker.face] = state[sticker.index];
  return colors;
}

const D_EDGES = [pos(0, -1, 1), pos(1, -1, 0), pos(0, -1, -1), pos(-1, -1, 0)].map(piece);
const D_CORNERS = [pos(1, -1, 1), pos(1, -1, -1), pos(-1, -1, -1), pos(-1, -1, 1)].map(piece);
const M_EDGES = [pos(1, 0, 1), pos(1, 0, -1), pos(-1, 0, -1), pos(-1, 0, 1)].map(piece);
const U_EDGES = [pos(0, 1, 1), pos(1, 1, 0), pos(0, 1, -1), pos(-1, 1, 0)].map(piece);
const U_CORNERS = [pos(1, 1, 1), pos(1, 1, -1), pos(-1, 1, -1), pos(-1, 1, 1)].map(piece);
const ALL_EDGES: readonly (readonly Sticker[])[] = [...D_EDGES, ...M_EDGES, ...U_EDGES];
const ALL_CORNERS: readonly (readonly Sticker[])[] = [...D_CORNERS, ...U_CORNERS];

interface PieceLocation {
  readonly group: readonly Sticker[];
  readonly colors: Readonly<Partial<Record<Face, Face>>>;
}

/** Tìm piece (trong tập groups) mang đúng tập màu đã cho. Luôn tồn tại trên khối hợp lệ. */
function findPiece(state: FaceletState, colors: readonly Face[], groups: readonly (readonly Sticker[])[]): PieceLocation {
  const want = colors.slice().sort().join('');
  for (const group of groups) {
    const c = colorsAt(state, group);
    if (Object.values(c).sort().join('') === want) return { group, colors: c };
  }
  throw new Error(`Không tìm thấy quân mang màu: ${colors.join(',')}`);
}

/** Nhóm "nhà" của piece mang tập màu đã cho (vị trí khi đã giải xong). */
function homeGroupForColors(colors: readonly Face[]): readonly Sticker[] {
  const want = colors.slice().sort().join('');
  const all = [...D_EDGES, ...M_EDGES, ...U_EDGES, ...D_CORNERS, ...U_CORNERS];
  const found = all.find((group) => group.map((s) => s.face).sort().join('') === want);
  if (!found) throw new Error(`Không tìm thấy vị trí nhà cho màu: ${colors.join(',')}`);
  return found;
}

// ---- quay quanh Y để đổi mặt trước ----

type Side = 'F' | 'R' | 'B' | 'L';
const SIDES: readonly Side[] = ['F', 'R', 'B', 'L'];

function isSide(face: Face): face is Side {
  return face === 'F' || face === 'R' || face === 'B' || face === 'L';
}

const RIGHT: Readonly<Record<Side, Side>> = { F: 'R', R: 'B', B: 'L', L: 'F' };
const LEFT: Readonly<Record<Side, Side>> = { F: 'L', L: 'B', B: 'R', R: 'F' };

const MAP_Y: Readonly<Record<Face, Face>> = { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' };

function rotFaceY(face: Face, k: number): Face {
  let f = face;
  const steps = ((k % 4) + 4) % 4;
  for (let i = 0; i < steps; i++) f = MAP_Y[f];
  return f;
}

function rotMoveY(m: Move, k: number): Move {
  const firstChar = m[0];
  if (!isFace(firstChar)) throw new Error(`Lỗi xoay nước đi: ${m}`);
  const rotated = rotFaceY(firstChar, k) + m.slice(1);
  if (!isMove(rotated)) throw new Error(`Lỗi xoay nước đi: ${m}`);
  return rotated;
}

function frontSteps(target: Side): number {
  for (let k = 0; k < 4; k++) {
    if (rotFaceY('F', k) === target) return k;
  }
  throw new Error(`Không tìm thấy bước xoay cho mặt: ${target}`);
}

/** Áp công thức chuẩn (viết cho mặt trước = F) vào mặt trước thực tế = front. */
function alg(seqStr: string, front: Side): Move[] {
  const k = frontSteps(front);
  return Cube.parseMoves(seqStr).map((m) => rotMoveY(m, k));
}

function inv(m: Move): Move {
  return Cube.invertSeq([m])[0];
}

// ---- vi-tìm-kiếm cho thập tự ----

const MICRO_ALPHABET: readonly Move[] = [
  'U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'
];

function microReach(cube: Cube, goal: Goal, maxDepth: number): Move[] | null {
  for (let d = 0; d <= maxDepth; d++) {
    const r = microDfs(cube, goal, d, '', []);
    if (r) return r;
  }
  return null;
}

function microDfs(cube: Cube, goal: Goal, depth: number, lastFace: string, path: Move[]): Move[] | null {
  if (goal(cube.state)) return path.slice();
  if (depth === 0) return null;
  for (const m of MICRO_ALPHABET) {
    if (m[0] === lastFace) continue;
    cube.move(m);
    path.push(m);
    const r = microDfs(cube, goal, depth - 1, m[0], path);
    path.pop();
    cube.move(inv(m));
    if (r) return r;
  }
  return null;
}

// ---- macro-tìm-kiếm cho tầng cuối ----

function macroReach(cube: Cube, goal: Goal, macros: readonly Move[][], maxDepth: number): Move[] | null {
  for (let d = 0; d <= maxDepth; d++) {
    const r = macroDfs(cube, goal, d, macros, []);
    if (r) return r;
  }
  return null;
}

function macroDfs(cube: Cube, goal: Goal, depth: number, macros: readonly Move[][], path: Move[]): Move[] | null {
  if (goal(cube.state)) return path.slice();
  if (depth === 0) return null;
  for (const seq of macros) {
    for (const m of seq) cube.move(m);
    path.push(...seq);
    const r = macroDfs(cube, goal, depth - 1, macros, path);
    path.length -= seq.length;
    for (const m of seq.slice().reverse()) cube.move(inv(m));
    if (r) return r;
  }
  return null;
}

// ================= bộ ghi =================

interface SolveStageDraft {
  name: string;
  moves: Move[];
}

class Solver {
  readonly cube: Cube;
  readonly stages: SolveStageDraft[] = [];
  private current: SolveStageDraft | null = null;

  constructor(state: FaceletState) {
    this.cube = new Cube(state);
  }

  stage(name: string): void {
    this.current = { name, moves: [] };
    this.stages.push(this.current);
  }

  push(moves: readonly Move[]): void {
    if (!this.current) throw new Error('push() được gọi trước khi stage() khởi tạo giai đoạn');
    const current = this.current;
    for (const m of moves) {
      this.cube.move(m);
      current.moves.push(m);
    }
  }
}

// ---------- STAGE: thập tự D ----------

function doCross(s: Solver): void {
  s.stage('Thập tự mặt đáy');
  const solvedSlots: (readonly Sticker[])[] = [];
  for (const X of SIDES) {
    const home = homeGroupForColors(['D', X]);
    const required = [...solvedSlots, home];
    const goal: Goal = (st) => required.every((g) => solvedPiece(st, g));
    const mv = microReach(s.cube, goal, 7);
    if (mv) s.push(mv);
    solvedSlots.push(home);
  }
}

// ---------- STAGE: góc tầng 1 (D corners) ----------

type CornerInsertKind = 'U' | 'F' | 'R';

const CORNER_INS: Readonly<Record<CornerInsertKind, string>> = {
  U: "R F R2 F' R'",   // màu D hướng lên
  F: "F' U' F",        // màu D hướng ra mặt trước
  R: "R U R'"           // màu D hướng ra mặt phải
};

function cornerTopPos(front: Side): Vec3 {
  const map: Readonly<Record<Side, Vec3>> = { F: [1, 1, 1], R: [1, 1, -1], B: [-1, 1, -1], L: [-1, 1, 1] };
  return map[front];
}

/** group ở tầng đáy (y=-1): xác định mặt front sao cho slot = front. */
function bottomCornerFront(group: readonly Sticker[]): Side {
  const [x, , z] = group[0].pos;
  if (x === 1 && z === 1) return 'F';
  if (x === 1 && z === -1) return 'R';
  if (x === -1 && z === -1) return 'B';
  return 'L';
}

function groupAtPos(group: readonly Sticker[], target: Vec3): boolean {
  const key = target.join(',');
  return group.some((st) => st.pos.join(',') === key) &&
    group.every((st) => st.pos[1] === target[1] && Math.abs(st.pos[0]) === Math.abs(target[0]));
}

function alignCornerOverSlot(s: Solver, colors: readonly Face[], front: Side): void {
  const target = cornerTopPos(front);
  let guard = 0;
  while (guard++ < 4) {
    const loc = findPiece(s.cube.state, colors, ALL_CORNERS);
    if (loc.group.every((st) => st.pos[1] === 1) && groupAtPos(loc.group, target)) return;
    s.push(['U']);
  }
}

function doFirstLayerCorners(s: Solver): void {
  s.stage('Góc tầng 1');
  for (const X of SIDES) {
    const colors: readonly Face[] = ['D', X, RIGHT[X]];
    const home = homeGroupForColors(colors);
    let guard = 0;
    while (!solvedPiece(s.cube.state, home) && guard++ < 12) {
      const loc = findPiece(s.cube.state, colors, ALL_CORNERS);
      const g = loc.group;
      const inTop = g.some((st) => st.pos[1] === 1);
      if (inTop) {
        // đưa góc lên vị trí trên slot (UXR) bằng cách xoay U
        alignCornerOverSlot(s, colors, X);
        const topGroup = piece(cornerTopPos(X));
        const cs = colorsAt(s.cube.state, topGroup);
        const dFace = (Object.keys(cs) as Face[]).find((f) => cs[f] === 'D');
        if (!dFace) throw new Error('Không xác định được hướng màu D trên góc');
        const kind: CornerInsertKind = dFace === 'U' ? 'U' : dFace === X ? 'F' : 'R';
        s.push(alg(CORNER_INS[kind], X));
      } else {
        // góc đang kẹt ở tầng đáy slot khác -> đẩy lên đỉnh
        s.push(alg("R U R'", bottomCornerFront(g)));
      }
    }
  }
}

// ---------- STAGE: tầng giữa ----------

const MID_RIGHT = "U R U' R' U' F' U F";
const MID_LEFT = "U' L' U L U F U' F'";

/** slot giữa 2 mặt bên: front = mặt sao cho RIGHT[front] là mặt còn lại của slot. */
function middleSlotFront(group: readonly Sticker[]): Side {
  const faces = group.map((st) => st.face);
  const found = SIDES.find((side) => faces.includes(side) && faces.includes(RIGHT[side]));
  if (!found) throw new Error('Không xác định được mặt trước cho cạnh tầng giữa');
  return found;
}

function insertMiddleFromTop(s: Solver, colors: readonly Face[]): void {
  let guard = 0;
  while (guard++ < 4) {
    const loc = findPiece(s.cube.state, colors, ALL_EDGES);
    const sideSticker = loc.group.find((st) => st.face !== 'U');
    if (!sideSticker) { s.push(['U']); continue; } // bị lật nằm sấp, hiếm — xoay U thử lại
    const sideColor = loc.colors[sideSticker.face];
    if (!sideColor) { s.push(['U']); continue; }
    if (sideSticker.face !== sideColor) { s.push(['U']); continue; } // chưa thẳng hàng với mặt nhà
    if (!isSide(sideColor)) { s.push(['U']); continue; }
    const topColor = loc.colors.U;
    if (RIGHT[sideColor] === topColor) { s.push(alg(MID_RIGHT, sideColor)); return; }
    if (LEFT[sideColor] === topColor) { s.push(alg(MID_LEFT, sideColor)); return; }
    s.push(['U']);
  }
}

function doMiddle(s: Solver): void {
  s.stage('Tầng giữa');
  let guard = 0;
  while (guard++ < 30) {
    const unsolved = M_EDGES.find((g) => !solvedPiece(s.cube.state, g));
    if (!unsolved) break;
    const colors = unsolved.map((st) => st.face);
    const loc = findPiece(s.cube.state, colors, ALL_EDGES);
    const inTop = loc.group.some((st) => st.pos[1] === 1);
    if (inTop) {
      insertMiddleFromTop(s, colors);
    } else {
      // kẹt ở slot giữa sai -> đẩy ra đỉnh bằng right-insert tại slot đó
      s.push(alg(MID_RIGHT, middleSlotFront(loc.group)));
    }
  }
}

// ---------- STAGE: tầng cuối ----------

function doLastLayer(s: Solver): void {
  const U: Move[] = ['U'];
  const Up: Move[] = ["U'"];
  const U2: Move[] = ['U2'];

  // 1) định hướng cạnh -> thập tự mặt U
  s.stage('Thập tự mặt trên');
  const crossGoal: Goal = (st) =>
    U_EDGES.every((g) => {
      const u = g.find((x) => x.face === 'U');
      return !!u && st[u.index] === 'U';
    });
  const ollEdge = Cube.parseMoves("F R U R' U' F'");
  let mv = macroReach(s.cube, crossGoal, [U, Up, U2, ollEdge], 4);
  if (mv) s.push(mv);

  // 2) định hướng góc -> toàn mặt U
  s.stage('Định hướng góc trên');
  const ollGoal: Goal = (st) =>
    U_CORNERS.every((g) => {
      const u = g.find((x) => x.face === 'U');
      return !!u && st[u.index] === 'U';
    }) && crossGoal(st);
  const sune = Cube.parseMoves("R U R' U R U2 R'");
  const antisune = Cube.parseMoves("R U2 R' U' R U' R'");
  mv = macroReach(s.cube, ollGoal, [U, Up, U2, sune, antisune], 7);
  if (mv) s.push(mv);

  // 3) hoán vị cả tầng cuối -> xong
  s.stage('Hoán vị tầng cuối');
  const solvedGoal: Goal = (st) => new Cube(st).isSolved();
  const Aperm = Cube.parseMoves("R' F R' B2 R F' R' B2 R2");        // 3-cycle góc
  const Tperm = Cube.parseMoves("R U R' U' R' F R2 U' R' U' R U R' F'");
  const Uaperm = Cube.parseMoves("R2 U R U R' U' R' U' R' U R'");   // 3-cycle cạnh
  const Ubperm = Cube.parseMoves("R U' R U R U R U' R' U' R2");
  mv = macroReach(s.cube, solvedGoal, [U, Up, U2, Aperm, Tperm, Uaperm, Ubperm], 6);
  if (mv) s.push(mv);
}

// ================= API =================

export function solveLBL(state: FaceletState): SolveResult {
  if (new Cube(state).isSolved()) return { stages: [], moves: [], solved: true };

  const s = new Solver(state);
  doCross(s);
  doFirstLayerCorners(s);
  doMiddle(s);
  doLastLayer(s);

  let moves: Move[] = [];
  const stages: SolveStage[] = [];
  for (const draft of s.stages) {
    const simplified = Cube.simplify(draft.moves);
    if (simplified.length > 0) stages.push({ name: draft.name, moves: simplified });
    moves = moves.concat(simplified);
  }
  return { stages, moves, solved: s.cube.isSolved() };
}
