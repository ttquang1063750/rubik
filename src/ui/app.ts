/**
 * Kết nối UI: nhập màu trên khối 3D, kiểm tra hợp lệ, gọi bộ giải, phát lại.
 */
import type {} from '../../public/vendor/cube'; // chỉ để kéo theo khai báo global window.Cube
import { Cube } from '../core/cube';
import { solveLBL } from '../core/solver-lbl';
import { RubikRenderer, assertFaceletState } from './renderer';
import type { DisplayState } from './renderer';
import type { Face, FaceletState, Move, SolveStage } from '../core/types';

// ---- bảng màu: thứ tự đẹp mắt, kèm ký tự mặt ----
interface PaletteEntry {
  readonly letter: Face;
  readonly name: string;
}
const PALETTE: readonly PaletteEntry[] = [
  { letter: 'U', name: 'Trắng' },
  { letter: 'D', name: 'Vàng' },
  { letter: 'F', name: 'Xanh lá' },
  { letter: 'B', name: 'Xanh dương' },
  { letter: 'R', name: 'Đỏ' },
  { letter: 'L', name: 'Cam' }
];
const CENTERS: readonly number[] = [4, 13, 22, 31, 40, 49];

// ---- trạng thái ----
let state: DisplayState = Cube.solved().state;
let selected: Face = 'U';
let inputMode = true;
let renderer: RubikRenderer;

// playback
let stages: readonly SolveStage[] = [];
let allMoves: readonly Move[] = [];
let baseState: FaceletState | null = null;
interface StageBound {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}
let stageBounds: StageBound[] = [];
let idx = 0;
let playing = false;
let durBase = 320;
let solverReady = false;

// ---- elements ----
function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Không tìm thấy phần tử #${id}`);
  return el;
}

function $input(id: string): HTMLInputElement {
  const el = $(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`#${id} không phải input`);
  return el;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function init(): void {
  renderer = new RubikRenderer($('cube3d'));
  renderer.setState(state);
  renderer.pickEnabled = true;
  renderer.onPick = (i) => {
    if (!inputMode) return;
    if (CENTERS.includes(i)) return; // không sửa ô tâm
    state[i] = selected;
    renderer.setState(state);
  };
  buildPalette();
  bindButtons();
}

function buildPalette(): void {
  const pal = $('palette');
  for (const p of PALETTE) {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (p.letter === selected ? ' active' : '');
    sw.style.background = RubikRenderer.COLORS[p.letter];
    sw.title = p.name;
    sw.onclick = () => {
      selected = p.letter;
      Array.from(pal.children).forEach((c) => c.classList.remove('active'));
      sw.classList.add('active');
    };
    pal.appendChild(sw);
  }
}

function bindButtons(): void {
  $('btnSolved').onclick = () => { setState(Cube.solved().state); msg('', ''); };
  $('btnClear').onclick = () => {
    const s: DisplayState = new Array(54).fill('.');
    (['U', 'R', 'F', 'D', 'L', 'B'] as const).forEach((f, k) => { s[CENTERS[k]] = f; });
    setState(s);
    msg('Đã xoá. Hãy tô lại các ô theo khối của bạn.', 'info');
  };
  $('btnScramble').onclick = () => {
    const seq = randomScramble(25);
    setState(Cube.solved().apply(seq).state);
    msg('Đã trộn ngẫu nhiên 25 nước.', 'info');
  };
  $('btnSolve').onclick = onSolve;
  $('btnEdit').onclick = backToEdit;

  $('btnFirst').onclick = () => { stopPlay(); seek(0); };
  $('btnLast').onclick = () => { stopPlay(); seek(allMoves.length); };
  $('btnPrev').onclick = () => { stopPlay(); stepPrev(); };
  $('btnNext').onclick = () => { stopPlay(); stepNext(); };
  $('btnPlay').onclick = () => { if (playing) stopPlay(); else startPlay(); };
  $('btnFast').onclick = () => { startPlay(true); };

  const speedInput = $input('speed');
  speedInput.oninput = () => {
    durBase = 620 - (Number(speedInput.value) - 1) * 60; // 1->620ms, 10->80ms
  };
  durBase = 620 - 4 * 60;
}

function setState(s: DisplayState): void {
  state = s.slice();
  renderer.setState(state);
}

type MsgKind = '' | 'err' | 'ok' | 'info';
function msg(text: string, kind: MsgKind): void {
  const m = $('msg');
  m.textContent = text;
  m.className = 'msg ' + kind;
}

function randomScramble(n: number): string {
  const faces: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const mods = ['', "'", '2'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(faces[(Math.random() * 6) | 0] + mods[(Math.random() * 3) | 0]);
  }
  return out.join(' ');
}

// ================= kiểm tra hợp lệ =================

type ValidationResult = { ok: true } | { ok: false; error: string };

function isPermutation(arr: readonly number[], n: number): boolean {
  if (arr.length !== n) return false;
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const v = arr[i];
    if (v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

function parity(arr: readonly number[]): number {
  let p = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] > arr[j]) p++;
    }
  }
  return p % 2;
}

function validate(facelet: string): ValidationResult {
  const counts: Partial<Record<string, number>> = {};
  for (let i = 0; i < 54; i++) {
    const ch = facelet[i];
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const emptyCount = counts['.'] ?? 0;
  if (emptyCount > 0) return { ok: false, error: `Còn ${emptyCount} ô chưa tô màu.` };

  const faces: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const bad = faces.filter((f) => counts[f] !== 9);
  if (bad.length > 0) return { ok: false, error: `Mỗi màu phải đúng 9 ô. Sai ở: ${bad.join(', ')}.` };

  try {
    const c = window.Cube.fromString(facelet);
    if (!isPermutation(c.cp, 8) || !isPermutation(c.ep, 12)) {
      return { ok: false, error: 'Có quân bị trùng/thiếu — kiểm tra lại màu.' };
    }
    const coSum = c.co.reduce((a, b) => a + b, 0);
    const eoSum = c.eo.reduce((a, b) => a + b, 0);
    if (coSum % 3 !== 0) return { ok: false, error: 'Một góc bị xoay sai hướng (không thể có thật).' };
    if (eoSum % 2 !== 0) return { ok: false, error: 'Một cạnh bị lật sai hướng (không thể có thật).' };
    if (parity(c.cp) !== parity(c.ep)) return { ok: false, error: 'Trạng thái không thể giải (sai 2 quân).' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Màu không hợp lệ — kiểm tra lại.' };
  }
}

// ================= giải =================

function selectedMethod(): 'kociemba' | 'lbl' {
  const el = document.querySelector<HTMLInputElement>('input[name="method"]:checked');
  if (!el) throw new Error('Không tìm thấy lựa chọn phương pháp giải');
  return el.value === 'lbl' ? 'lbl' : 'kociemba';
}

function onSolve(): void {
  const facelet = state.join('');
  const v = validate(facelet);
  if (!v.ok) { msg('⚠️ ' + v.error, 'err'); return; }
  const method = selectedMethod();

  if (method === 'kociemba') {
    msg('⏳ Đang chuẩn bị bộ giải nhanh…', 'info');
    // initSolver nặng -> chạy sau 1 nhịp để UI kịp hiện thông báo
    setTimeout(() => {
      try {
        if (!solverReady) { window.Cube.initSolver(); solverReady = true; }
        const sol = window.Cube.fromString(facelet).solve();
        const moves = Cube.simplify(sol);
        startPlayback(
          [{ name: 'Lời giải tối ưu (Kociemba)', moves }],
          moves,
          `${moves.length} nước · thuật toán Kociemba`
        );
      } catch (e) {
        msg('Không giải được: ' + errorMessage(e), 'err');
      }
    }, 30);
  } else {
    try {
      const res = solveLBL(assertFaceletState(state));
      if (!res.solved) { msg('Lỗi nội bộ khi giải tầng-by-tầng.', 'err'); return; }
      startPlayback(res.stages, res.moves, `${res.moves.length} nước · ${res.stages.length} giai đoạn`);
    } catch (e) {
      msg('Không giải được: ' + errorMessage(e), 'err');
    }
  }
}

// ================= phát lại =================

function startPlayback(stg: readonly SolveStage[], moves: readonly Move[], info: string): void {
  stages = stg;
  allMoves = moves;
  baseState = assertFaceletState(state);
  idx = 0;

  stageBounds = [];
  let acc = 0;
  for (const s of stages) {
    stageBounds.push({ name: s.name, start: acc, end: acc + s.moves.length });
    acc += s.moves.length;
  }

  inputMode = false;
  renderer.pickEnabled = false;
  $('inputPanel').classList.add('hidden');
  $('playPanel').classList.remove('hidden');
  $('solveInfo').textContent = info;
  $('modeHint').textContent = 'Đang xem lời giải';
  renderMovesList();
  seek(0);
  msg('', '');
}

function backToEdit(): void {
  stopPlay();
  inputMode = true;
  renderer.pickEnabled = true;
  renderer.setState(state); // giữ nguyên màu đã nhập
  $('playPanel').classList.add('hidden');
  $('inputPanel').classList.remove('hidden');
  $('modeHint').textContent = 'Chạm vào ô để tô màu đang chọn';
  msg('', '');
}

function renderMovesList(): void {
  const wrap = $('movesList');
  wrap.innerHTML = '';
  let gi = 0;
  stages.forEach((s, si) => {
    const group = document.createElement('div');
    group.className = 'stage-group';
    if (stages.length > 1) {
      const name = document.createElement('div');
      name.className = 'gname';
      name.textContent = `${si + 1}. ${s.name} (${s.moves.length})`;
      group.appendChild(name);
    }
    const chips = document.createElement('div');
    chips.className = 'chips';
    s.moves.forEach((m) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = m;
      chip.dataset.i = String(gi);
      const captured = gi;
      chip.onclick = () => { stopPlay(); seek(captured + 1); };
      chips.appendChild(chip);
      gi++;
    });
    group.appendChild(chips);
    wrap.appendChild(group);
  });
}

function updateUI(): void {
  $('moveCounter').textContent = `${idx} / ${allMoves.length}`;
  // giai đoạn hiện tại: tìm giai đoạn chứa nước sắp đi (idx)
  let label = '';
  for (const b of stageBounds) {
    if (idx >= b.start && idx < b.end) { label = b.name; break; }
  }
  if (idx >= allMoves.length && allMoves.length > 0) label = '✅ Đã giải xong!';
  $('stageLabel').textContent = label;
  $('btnPlay').textContent = playing ? '⏸' : '▶';
  const chips = $('movesList').querySelectorAll<HTMLElement>('.chip');
  chips.forEach((c) => {
    const i = Number(c.dataset.i);
    c.classList.toggle('done', i < idx);
    c.classList.toggle('current', i === idx);
  });
}

/** nhảy tức thời tới vị trí k (0..N) */
function seek(k: number): void {
  if (!baseState) return;
  idx = Math.max(0, Math.min(allMoves.length, k));
  const c = new Cube(baseState);
  c.apply(allMoves.slice(0, idx));
  renderer.setState(c.state);
  updateUI();
}

function stepNext(cb?: () => void): void {
  if (idx >= allMoves.length || renderer.animating) { cb?.(); return; }
  const m = allMoves[idx];
  renderer.animateMove(m, durBase, () => { idx++; updateUI(); cb?.(); });
}

function stepPrev(): void {
  if (idx <= 0 || renderer.animating) return;
  const m = Cube.invertSeq([allMoves[idx - 1]])[0];
  renderer.animateMove(m, durBase, () => { idx--; updateUI(); });
}

function startPlay(fast = false): void {
  if (idx >= allMoves.length) seek(0);
  playing = true;
  updateUI();
  const loop = (): void => {
    if (!playing || idx >= allMoves.length) { playing = false; updateUI(); return; }
    const m = allMoves[idx];
    const d = fast ? 90 : durBase; // đọc lại mỗi nước để kéo "Tốc độ" có tác dụng ngay khi đang chạy
    renderer.animateMove(m, d, () => { idx++; updateUI(); if (playing) loop(); });
  };
  loop();
}

function stopPlay(): void {
  playing = false;
  updateUI();
}

window.addEventListener('DOMContentLoaded', init);
