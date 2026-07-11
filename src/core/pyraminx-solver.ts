import * as THREE from 'three';
import type { Move, SolveResult, SolveStage } from './types';

// Định nghĩa màu sắc Pyraminx
export type PyraminxColor = 'Y' | 'R' | 'G' | 'B'; // Yellow, Red, Green, Blue
export type PyraminxState = PyraminxColor[];

// Tọa độ 3D của 4 đỉnh chóp chính tứ diện đều cạnh bằng 3, tâm ở (0,0,0)
const VU = new THREE.Vector3(0, 1.837, 0);
const VL = new THREE.Vector3(-1.5, -0.612, 0.866);
const VR = new THREE.Vector3(1.5, -0.612, 0.866);
const VB = new THREE.Vector3(0, -0.612, -1.732);

interface FaceDef {
  readonly name: string;
  readonly A: THREE.Vector3;
  readonly B: THREE.Vector3;
  readonly C: THREE.Vector3;
}

const faces: readonly FaceDef[] = [
  { name: 'F', A: VU, B: VL, C: VR }, // Front -> Màu Đỏ (Red)
  { name: 'L', A: VU, B: VB, C: VL }, // Left -> Xanh lá (Green)
  { name: 'R', A: VU, B: VR, C: VB }, // Right -> Vàng (Yellow)
  { name: 'D', A: VL, B: VB, C: VR }  // Down/Bottom -> Xanh dương (Blue)
];

interface Cell3D {
  readonly index: number;
  readonly face: string;
  readonly cellIndex: number;
  readonly pos: THREE.Vector3;
}

// Sinh 36 ô tam giác nhỏ của Pyraminx
const cells: Cell3D[] = [];

faces.forEach((f, fIdx) => {
  const points: THREE.Vector3[] = [];
  for (let i = 3; i >= 0; i--) {
    for (let j = 0; j <= 3 - i; j++) {
      const k = 3 - i - j;
      const p = new THREE.Vector3()
        .addScaledVector(f.A, i / 3)
        .addScaledVector(f.B, j / 3)
        .addScaledVector(f.C, k / 3);
      points.push(p);
    }
  }

  const getP = (i: number, j: number, k: number): THREE.Vector3 => {
    let idx = 0;
    for (let r = 3; r >= 0; r--) {
      for (let c = 0; c <= 3 - r; c++) {
        const d = 3 - r - c;
        if (r === i && c === j && d === k) return points[idx];
        idx++;
      }
    }
    throw new Error(`Không tìm thấy điểm chia (${i},${j},${k})`);
  };

  const addCell = (cellIdx: number, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): void => {
    const center = new THREE.Vector3()
      .add(p1).add(p2).add(p3)
      .divideScalar(3);
    cells.push({
      index: fIdx * 9 + cellIdx,
      face: f.name,
      cellIndex: cellIdx,
      pos: center
    });
  };

  addCell(0, getP(3, 0, 0), getP(2, 1, 0), getP(2, 0, 1));
  addCell(1, getP(2, 1, 0), getP(1, 2, 0), getP(1, 1, 1));
  addCell(2, getP(2, 1, 0), getP(1, 1, 1), getP(2, 0, 1));
  addCell(3, getP(2, 0, 1), getP(1, 1, 1), getP(1, 0, 2));
  addCell(4, getP(1, 2, 0), getP(0, 3, 0), getP(0, 2, 1));
  addCell(5, getP(1, 2, 0), getP(0, 2, 1), getP(1, 1, 1));
  addCell(6, getP(1, 1, 1), getP(0, 2, 1), getP(0, 1, 2));
  addCell(7, getP(1, 0, 2), getP(1, 1, 1), getP(0, 1, 2));
  addCell(8, getP(1, 0, 2), getP(0, 1, 2), getP(0, 0, 3));
});

const tips: Record<string, { pos: THREE.Vector3; axis: THREE.Vector3 }> = {
  U: { pos: VU, axis: VU.clone().normalize() },
  L: { pos: VL, axis: VL.clone().normalize() },
  R: { pos: VR, axis: VR.clone().normalize() },
  B: { pos: VB, axis: VB.clone().normalize() }
};

// Hàm sinh hoán vị bằng hình học 3D
export function makePermutation(tipKey: string, angleRad: number, isTipOnly: boolean): number[] {
  const { pos: tipPos, axis } = tips[tipKey];
  const perm = Array.from({ length: 36 }, (_, i) => i);
  const threshold = isTipOnly ? 0.8 : 2.0;

  cells.forEach((c) => {
    const dist = c.pos.distanceTo(tipPos);
    if (dist < threshold) {
      const rotated = c.pos.clone().applyAxisAngle(axis, angleRad);
      let bestIdx = -1;
      let minDist = Infinity;
      cells.forEach((tc) => {
        const d = tc.pos.distanceTo(rotated);
        if (d < minDist) {
          minDist = d;
          bestIdx = tc.index;
        }
      });
      if (minDist < 0.05) {
        perm[bestIdx] = c.index;
      }
    }
  });

  return perm;
}

const rad120 = (120 * Math.PI) / 180;

// Tạo sẵn bảng hoán vị cho các nước đi cơ bản
const PERMS: Record<string, number[]> = {
  U: makePermutation('U', -rad120, false),
  "U'": makePermutation('U', rad120, false),
  L: makePermutation('L', -rad120, false),
  "L'": makePermutation('L', rad120, false),
  R: makePermutation('R', -rad120, false),
  "R'": makePermutation('R', rad120, false),
  B: makePermutation('B', -rad120, false),
  "B'": makePermutation('B', rad120, false),

  // Chóp nhỏ
  u: makePermutation('U', -rad120, true),
  "u'": makePermutation('U', rad120, true),
  l: makePermutation('L', -rad120, true),
  "l'": makePermutation('L', rad120, true),
  r: makePermutation('R', -rad120, true),
  "r'": makePermutation('R', rad120, true),
  b: makePermutation('B', -rad120, true),
  "b'": makePermutation('B', rad120, true)
};

export class Pyraminx {
  readonly state: PyraminxState;

  constructor(state?: PyraminxState) {
    this.state = state ? state.slice() : new Array(36).fill('Y');
  }

  static solved(): Pyraminx {
    const s: PyraminxColor[] = [];
    // F: màu Red ('R')
    for (let i = 0; i < 9; i++) s.push('R');
    // L: màu Green ('G')
    for (let i = 0; i < 9; i++) s.push('G');
    // R: màu Yellow ('Y')
    for (let i = 0; i < 9; i++) s.push('Y');
    // D: màu Blue ('B')
    for (let i = 0; i < 9; i++) s.push('B');
    return new Pyraminx(s);
  }

  move(m: Move): Pyraminx {
    const perm = PERMS[m];
    if (!perm) throw new Error(`Nước đi Pyraminx không hợp lệ: ${m}`);
    const nextState = new Array<PyraminxColor>(36);
    for (let i = 0; i < 36; i++) {
      nextState[i] = this.state[perm[i]];
    }
    return new Pyraminx(nextState);
  }

  apply(scramble: string): Pyraminx {
    let curr: Pyraminx = this;
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      curr = curr.move(t as Move);
    }
    return curr;
  }
}

// Bảng các nước đi nghịch đảo
const INV_MOVE: Record<string, string> = {
  U: "U'", "U'": "U",
  L: "L'", "L'": "L",
  R: "R'", "R'": "R",
  B: "B'", "B'": "B",
  u: "u'", "u'": "u",
  l: "l'", "l'": "l",
  r: "r'", "r'": "r",
  b: "b'", "b'": "b"
};

export function inversePyraminxMove(m: Move): Move {
  return (INV_MOVE[m] ?? m) as Move;
}

// ================= BỘ GIẢI PYRAMINX =================

export function solvePyraminx(state: PyraminxState): SolveResult {
  const moves: Move[] = [];
  const stages: SolveStage[] = [];
  let curr = new Pyraminx(state);

  // Stage 1: Giải các chóp nhỏ (tips)
  const tipMoves: Move[] = [];
  // Chóp U: so sánh ô 0 (F) và ô 2 (F)
  if (curr.state[0] !== curr.state[2]) {
    const m = curr.state[PERMS['u'][0]] === curr.state[2] ? 'u' : "u'";
    tipMoves.push(m as Move);
    curr = curr.move(m as Move);
  }
  // Chóp L: so sánh ô 4 (F) và ô 5 (F)
  if (curr.state[4] !== curr.state[5]) {
    const m = curr.state[PERMS['l'][4]] === curr.state[5] ? 'l' : "l'";
    tipMoves.push(m as Move);
    curr = curr.move(m as Move);
  }
  // Chóp R: so sánh ô 8 (F) và ô 7 (F)
  if (curr.state[8] !== curr.state[7]) {
    const m = curr.state[PERMS['r'][8]] === curr.state[7] ? 'r' : "r'";
    tipMoves.push(m as Move);
    curr = curr.move(m as Move);
  }
  // Chóp B: so sánh ô 13 (L) và ô 14 (L)
  if (curr.state[13] !== curr.state[14]) {
    const m = curr.state[PERMS['b'][13]] === curr.state[14] ? 'b' : "b'";
    tipMoves.push(m as Move);
    curr = curr.move(m as Move);
  }

  if (tipMoves.length > 0) {
    moves.push(...tipMoves);
    stages.push({ name: 'tips' as const, moves: tipMoves });
  }

  // Stage 2: Giải các góc chính (centers)
  // Xoay U, L, R, B sao cho các góc chính khớp màu nhau trên từng mặt
  const centerMoves: Move[] = [];
  const targetColor = 'R'; // Ta chọn mặt F làm mốc màu Đỏ

  // Góc U: xoay U cho đến khi ô 2 (F) có màu Red
  if (curr.state[2] !== targetColor) {
    const m = curr.state[PERMS['U'][2]] === targetColor ? 'U' : "U'";
    centerMoves.push(m as Move);
    curr = curr.move(m as Move);
  }
  // Góc L: xoay L cho đến khi ô 5 (F) có màu Red
  if (curr.state[5] !== targetColor) {
    const m = curr.state[PERMS['L'][5]] === targetColor ? 'L' : "L'";
    centerMoves.push(m as Move);
    curr = curr.move(m as Move);
  }
  // Góc R: xoay R cho đến khi ô 7 (F) có màu Red
  if (curr.state[7] !== targetColor) {
    const m = curr.state[PERMS['R'][7]] === targetColor ? 'R' : "R'";
    centerMoves.push(m as Move);
    curr = curr.move(m as Move);
  }
  // Góc B: xoay B cho đến khi ô 14 (L) trùng màu ô 11 (L) (đã giải ở góc U)
  if (curr.state[14] !== curr.state[11]) {
    const m = curr.state[PERMS['B'][14]] === curr.state[11] ? 'B' : "B'";
    centerMoves.push(m as Move);
    curr = curr.move(m as Move);
  }

  if (centerMoves.length > 0) {
    moves.push(...centerMoves);
    stages.push({ name: 'centers' as const, moves: centerMoves });
  }

  // Stage 3: Giải 6 cạnh (Edges) bằng Bidirectional BFS
  const edgeMoves = solveEdgesBFS(curr);
  if (edgeMoves.length > 0) {
    moves.push(...edgeMoves);
    stages.push({ name: 'edges' as const, moves: edgeMoves });
  }

  const solved = isSolved(curr.apply(edgeMoves.join(' ')).state);

  return {
    stages,
    moves,
    solved
  };
}

function isSolved(state: PyraminxState): boolean {
  const ref = Pyraminx.solved().state;
  for (let i = 0; i < 36; i++) {
    if (state[i] !== ref[i]) return false;
  }
  return true;
}

// Giải thuật Bidirectional BFS
function solveEdgesBFS(startCube: Pyraminx): Move[] {
  if (isSolved(startCube.state)) return [];

  const startSig = startCube.state.join('');
  const solvedSig = Pyraminx.solved().state.join('');

  // 8 nước đi lớp lớn
  const allowedMoves: Move[] = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"] as Move[];

  // Đầu 1 (xuôi)
  const forwardQueue: string[] = [startSig];
  const forwardVisited = new Map<string, { parent: string; move: Move }>();
  forwardVisited.set(startSig, { parent: '', move: '' as Move });

  // Đầu 2 (ngược)
  const backwardQueue: string[] = [solvedSig];
  const backwardVisited = new Map<string, { parent: string; move: Move }>();
  backwardVisited.set(solvedSig, { parent: '', move: '' as Move });

  let depth = 0;
  const maxDepth = 7; // Tổng tối đa 14 nước đi giải cạnh

  while (forwardQueue.length > 0 && backwardQueue.length > 0 && depth < maxDepth) {
    // 1. Quét forward level
    const fSize = forwardQueue.length;
    for (let i = 0; i < fSize; i++) {
      const currSig = forwardQueue.shift()!;
      const currCube = new Pyraminx(currSig.split('') as PyraminxColor[]);

      // Nếu gặp đầu 2
      if (backwardVisited.has(currSig)) {
        return buildPath(currSig, forwardVisited, backwardVisited);
      }

      for (const m of allowedMoves) {
        const nextCube = currCube.move(m);
        const nextSig = nextCube.state.join('');
        if (!forwardVisited.has(nextSig)) {
          forwardVisited.set(nextSig, { parent: currSig, move: m });
          forwardQueue.push(nextSig);
        }
      }
    }

    // 2. Quét backward level
    const bSize = backwardQueue.length;
    for (let i = 0; i < bSize; i++) {
      const currSig = backwardQueue.shift()!;
      const currCube = new Pyraminx(currSig.split('') as PyraminxColor[]);

      // Nếu gặp đầu 1
      if (forwardVisited.has(currSig)) {
        return buildPath(currSig, forwardVisited, backwardVisited);
      }

      for (const m of allowedMoves) {
        // Đi ngược tương đương với áp dụng nước nghịch đảo của m
        const invM = inversePyraminxMove(m);
        const nextCube = currCube.move(invM);
        const nextSig = nextCube.state.join('');
        if (!backwardVisited.has(nextSig)) {
          backwardVisited.set(nextSig, { parent: currSig, move: m }); // lưu m là nước đi xuôi để từ parent về solved
          backwardQueue.push(nextSig);
        }
      }
    }

    depth++;
  }

  throw new Error('Không tìm thấy lời giải cạnh Pyraminx (Parity bất khả thi)');
}

function buildPath(
  meetSig: string,
  forwardVisited: Map<string, { parent: string; move: Move }>,
  backwardVisited: Map<string, { parent: string; move: Move }>
): Move[] {
  const path: Move[] = [];

  // Lấy đường đi xuôi (từ start -> meet)
  let curr = meetSig;
  while (curr) {
    const info = forwardVisited.get(curr);
    if (!info || !info.parent) break;
    path.unshift(info.move);
    curr = info.parent;
  }

  // Lấy đường đi ngược (từ meet -> solved)
  curr = meetSig;
  while (curr) {
    const info = backwardVisited.get(curr);
    if (!info || !info.parent) break;
    path.push(info.move);
    curr = info.parent;
  }

  return path;
}
