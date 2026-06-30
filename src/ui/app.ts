/**
 * Kết nối UI: nhập màu trên khối 3D, kiểm tra hợp lệ, gọi bộ giải, phát lại.
 */
import type {} from '../../public/vendor/cube'; // chỉ để kéo theo khai báo global window.Cube
import { Cube } from '../core/cube';
import { solveLBL } from '../core/solver-lbl';
import { RubikRenderer, assertFaceletState } from './renderer';
import type { DisplayState } from './renderer';
import type { Face, FaceletState, Move, SolveStage, StageKey } from '../core/types';
import { colorLabel, getLang, isI18nKey, setLang, stageLabel, t } from './i18n';
import type { Lang } from './i18n';

// ---- bảng màu: thứ tự đẹp mắt, kèm ký tự mặt ----
const PALETTE: readonly Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];
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
  readonly name: StageKey;
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
  applyTranslations();
}

function buildPalette(): void {
  const pal = $('palette');
  pal.innerHTML = '';
  for (const letter of PALETTE) {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (letter === selected ? ' active' : '');
    sw.style.background = RubikRenderer.COLORS[letter];
    sw.title = colorLabel(letter);
    sw.onclick = () => {
      selected = letter;
      Array.from(pal.children).forEach((c) => c.classList.remove('active'));
      sw.classList.add('active');
    };
    pal.appendChild(sw);
  }
}

// ================= đa ngôn ngữ =================

function applyTranslations(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key && isI18nKey(key)) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key && isI18nKey(key)) el.title = t(key);
  });
  $('btnLang').textContent = getLang() === 'vi' ? 'EN' : 'VI';
  updateModeHint();
  if (stages.length > 0) {
    updateSolveInfo();
    renderMovesList();
    updateUI();
  }
}

function updateModeHint(): void {
  $('modeHint').textContent = inputMode ? t('modeHint.color') : t('modeHint.playback');
}

function switchLang(lang: Lang): void {
  setLang(lang);
  buildPalette();
  applyTranslations();
}

function bindButtons(): void {
  $('btnSolved').onclick = () => { setState(Cube.solved().state); msg('', ''); };
  $('btnClear').onclick = () => {
    const s: DisplayState = new Array(54).fill('.');
    (['U', 'R', 'F', 'D', 'L', 'B'] as const).forEach((f, k) => { s[CENTERS[k]] = f; });
    setState(s);
    msg(t('msg.cleared'), 'info');
  };
  $('btnScramble').onclick = () => {
    const seq = randomScramble(25);
    setState(Cube.solved().apply(seq).state);
    msg(t('msg.scrambled'), 'info');
  };
  $('btnSolve').onclick = onSolve;
  $('btnEdit').onclick = backToEdit;

  $('btnFirst').onclick = () => { stopPlay(); seek(0); };
  $('btnLast').onclick = () => { stopPlay(); seek(allMoves.length); };
  $('btnPrev').onclick = () => { stopPlay(); stepPrev(); };
  $('btnNext').onclick = () => { stopPlay(); stepNext(); };
  $('btnPlay').onclick = () => { if (playing) stopPlay(); else startPlay(); };
  $('btnFast').onclick = () => { startPlay(true); };
  $('btnLang').onclick = () => { switchLang(getLang() === 'vi' ? 'en' : 'vi'); };
  $('btnHelp').onclick = () => { $('helpPanel').classList.toggle('hidden'); };

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
  if (emptyCount > 0) return { ok: false, error: t('err.emptyTilesTpl', emptyCount) };

  const faces: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const bad = faces.filter((f) => counts[f] !== 9);
  if (bad.length > 0) return { ok: false, error: t('err.wrongCountTpl', bad.join(', ')) };

  try {
    const c = window.Cube.fromString(facelet);
    if (!isPermutation(c.cp, 8) || !isPermutation(c.ep, 12)) {
      return { ok: false, error: t('err.duplicateMissing') };
    }
    const coSum = c.co.reduce((a, b) => a + b, 0);
    const eoSum = c.eo.reduce((a, b) => a + b, 0);
    if (coSum % 3 !== 0) return { ok: false, error: t('err.cornerTwist') };
    if (eoSum % 2 !== 0) return { ok: false, error: t('err.edgeFlip') };
    if (parity(c.cp) !== parity(c.ep)) return { ok: false, error: t('err.parity') };
    return { ok: true };
  } catch {
    return { ok: false, error: t('err.invalidColors') };
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
    msg(t('msg.preparingSolver'), 'info');
    // initSolver nặng -> chạy sau 1 nhịp để UI kịp hiện thông báo
    setTimeout(() => {
      try {
        if (!solverReady) { window.Cube.initSolver(); solverReady = true; }
        const sol = window.Cube.fromString(facelet).solve();
        const moves = Cube.simplify(sol);
        startPlayback([{ name: 'kociembaOptimal', moves }], moves, 'kociemba');
      } catch (e) {
        msg(t('msg.solveFailedPrefix') + errorMessage(e), 'err');
      }
    }, 30);
  } else {
    try {
      const res = solveLBL(assertFaceletState(state));
      if (!res.solved) { msg(t('msg.lblInternalError'), 'err'); return; }
      startPlayback(res.stages, res.moves, 'lbl');
    } catch (e) {
      msg(t('msg.solveFailedPrefix') + errorMessage(e), 'err');
    }
  }
}

// ================= phát lại =================

type SolveMethod = 'kociemba' | 'lbl';
let lastSolveMethod: SolveMethod | null = null;

function startPlayback(stg: readonly SolveStage[], moves: readonly Move[], method: SolveMethod): void {
  stages = stg;
  allMoves = moves;
  lastSolveMethod = method;
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
  updateSolveInfo();
  updateModeHint();
  renderMovesList();
  seek(0);
  msg('', '');
}

function updateSolveInfo(): void {
  if (!lastSolveMethod) return;
  $('solveInfo').textContent = lastSolveMethod === 'kociemba'
    ? t('solveInfo.kociembaTpl', allMoves.length)
    : t('solveInfo.lblTpl', allMoves.length, stages.length);
}

function backToEdit(): void {
  stopPlay();
  inputMode = true;
  renderer.pickEnabled = true;
  renderer.setState(state); // giữ nguyên màu đã nhập
  $('playPanel').classList.add('hidden');
  $('inputPanel').classList.remove('hidden');
  updateModeHint();
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
      name.textContent = `${si + 1}. ${stageLabel(s.name)} (${s.moves.length})`;
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
    if (idx >= b.start && idx < b.end) { label = stageLabel(b.name); break; }
  }
  if (idx >= allMoves.length && allMoves.length > 0) label = t('msg.solvedDone');
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
