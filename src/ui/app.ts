/**
 * Kết nối UI: nhập màu trên khối 3D (3x3 hoặc Pyraminx), kiểm tra hợp lệ, gọi bộ giải, phát lại.
 */
import type {} from '../../public/vendor/cube'; // chỉ để kéo theo khai báo global window.Cube
import { Cube } from '../core/cube';
import { solveLBL } from '../core/solver-lbl';
import { RubikRenderer, assertFaceletState } from './renderer';
import type { DisplayState } from './renderer';
import { Pyraminx, solvePyraminx, inversePyraminxMove } from '../core/pyraminx-solver';
import type { PyraminxState, PyraminxColor } from '../core/pyraminx-solver';
import { PyraminxRenderer } from './pyraminx-renderer';
import type { PyraminxDisplayState, PyraminxDisplayCell } from './pyraminx-renderer';
import type { Face, FaceletState, Move, SolveStage, StageKey } from '../core/types';
import { colorLabel, getLang, isI18nKey, setLang, stageLabel, t } from './i18n';
import type { Lang } from './i18n';

// ---- Khai báo giao diện chung cho Renderer ----
interface IRenderer {
  setState(state: string[]): void;
  animateMove(m: Move, ms: number, cb?: () => void): void;
  destroy(): void;
  pickEnabled: boolean;
  onPick: ((i: number) => void) | null;
  readonly animating: boolean;
}

// ---- bảng màu ----
const PALETTE_3X3: readonly Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];
const PALETTE_PYRA: readonly string[] = ['R', 'G', 'Y', 'B'];
const CENTERS_3X3: readonly number[] = [4, 13, 22, 31, 40, 49];

// ---- trạng thái ----
let activeMode: '3x3' | 'pyraminx' = '3x3';
let rubikState: DisplayState = Cube.solved().state;
let pyraminxState: PyraminxDisplayState = Pyraminx.solved().state;

let selectedColor: string = 'U'; // 'U' cho 3x3, 'R' cho Pyraminx
let inputMode = true;
let activeRenderer!: IRenderer;

// playback
let stages: readonly SolveStage[] = [];
let allMoves: readonly Move[] = [];
let baseState3x3: FaceletState | null = null;
let baseStatePyra: PyraminxState | null = null;

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

type MsgKind = '' | 'err' | 'ok' | 'info';
function msg(text: string, kind: MsgKind): void {
  const m = $('msg');
  m.textContent = text;
  m.className = 'msg ' + kind;
}

function init(): void {
  // Khởi tạo renderer mặc định (3x3)
  const container = $('cube3d');
  const rubik = new RubikRenderer(container);
  rubik.setState(rubikState);
  rubik.pickEnabled = true;
  rubik.onPick = (i) => {
    if (!inputMode) return;
    if (CENTERS_3X3.includes(i)) return; // không sửa ô tâm
    rubikState[i] = selectedColor as Face;
    activeRenderer.setState(rubikState);
  };
  activeRenderer = rubik;

  // Gắn sự kiện chuyển đổi chế độ
  $('btnMode3x3').onclick = () => switchMode('3x3');
  $('btnModePyraminx').onclick = () => switchMode('pyraminx');

  buildPalette();
  renderMethodSelect();
  bindButtons();
  applyTranslations();
}

function switchMode(mode: '3x3' | 'pyraminx'): void {
  if (activeMode === mode) return;

  stopPlay();
  activeRenderer.destroy();

  activeMode = mode;
  inputMode = true;

  // Cập nhật giao diện switcher
  $('btnMode3x3').classList.toggle('active', mode === '3x3');
  $('btnModePyraminx').classList.toggle('active', mode === 'pyraminx');

  $('playPanel').classList.add('hidden');
  $('inputPanel').classList.remove('hidden');

  const container = $('cube3d');
  if (mode === '3x3') {
    selectedColor = 'U';
    const rubik = new RubikRenderer(container);
    rubik.setState(rubikState);
    rubik.pickEnabled = true;
    rubik.onPick = (i) => {
      if (!inputMode) return;
      if (CENTERS_3X3.includes(i)) return;
      rubikState[i] = selectedColor as Face;
      activeRenderer.setState(rubikState);
    };
    activeRenderer = rubik;
  } else {
    selectedColor = 'R';
    const pyra = new PyraminxRenderer(container);
    pyra.setState(pyraminxState);
    pyra.pickEnabled = true;
    pyra.onPick = (i) => {
      if (!inputMode) return;
      pyraminxState[i] = selectedColor as PyraminxDisplayCell;
      activeRenderer.setState(pyraminxState);
    };
    activeRenderer = pyra;
  }

  buildPalette();
  renderMethodSelect();
  updateModeHint();
  msg('', '');
  applyTranslations();
}

function buildPalette(): void {
  const pal = $('palette');
  pal.innerHTML = '';
  const currentPalette = activeMode === '3x3' ? PALETTE_3X3 : PALETTE_PYRA;

  for (const letter of currentPalette) {
    const sw = document.createElement('div');
    sw.className = 'swatch' + (letter === selectedColor ? ' active' : '');
    
    if (activeMode === '3x3') {
      sw.style.background = RubikRenderer.COLORS[letter as Face];
      sw.title = colorLabel(letter as Face);
    } else {
      sw.style.background = PyraminxRenderer.COLORS[letter as Exclude<PyraminxDisplayCell, '.'>];
      sw.title = colorLabel(letter as 'Y' | 'G' | 'R' | 'B');
    }

    sw.onclick = () => {
      selectedColor = letter;
      Array.from(pal.children).forEach((c) => c.classList.remove('active'));
      sw.classList.add('active');
    };
    pal.appendChild(sw);
  }
}

function renderMethodSelect(): void {
  const wrap = $('methodSelect');
  wrap.innerHTML = '';

  if (activeMode === '3x3') {
    wrap.innerHTML = `
      <label class="radio">
        <input type="radio" name="method" value="kociemba" checked />
        <span><b data-i18n="method.kociemba.title">${t('method.kociemba.title')}</b><small data-i18n="method.kociemba.desc">${t('method.kociemba.desc')}</small></span>
      </label>
      <label class="radio">
        <input type="radio" name="method" value="lbl" />
        <span><b data-i18n="method.lbl.title">${t('method.lbl.title')}</b><small data-i18n="method.lbl.desc">${t('method.lbl.desc')}</small></span>
      </label>
    `;
  } else {
    wrap.innerHTML = `
      <label class="radio">
        <input type="radio" name="method" value="pyraminx" checked />
        <span><b data-i18n="method.pyraminx.title">${t('method.pyraminx.title')}</b><small data-i18n="method.pyraminx.desc">${t('method.pyraminx.desc')}</small></span>
      </label>
    `;
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
  renderMethodSelect();
  applyTranslations();
}

function bindButtons(): void {
  $('btnSolved').onclick = () => {
    if (activeMode === '3x3') {
      rubikState = Cube.solved().state;
      activeRenderer.setState(rubikState);
    } else {
      pyraminxState = Pyraminx.solved().state;
      activeRenderer.setState(pyraminxState);
    }
    msg('', '');
  };

  $('btnClear').onclick = () => {
    if (activeMode === '3x3') {
      const s: DisplayState = new Array(54).fill('.');
      CENTERS_3X3.forEach((centerIndex, k) => { s[centerIndex] = PALETTE_3X3[k]; });
      rubikState = s;
      activeRenderer.setState(rubikState);
    } else {
      pyraminxState = new Array<PyraminxDisplayCell>(36).fill('.');
      activeRenderer.setState(pyraminxState);
    }
    msg(t('msg.cleared'), 'info');
  };

  $('btnScramble').onclick = () => {
    if (activeMode === '3x3') {
      const seq = randomScramble(25);
      rubikState = Cube.solved().apply(seq).state;
      activeRenderer.setState(rubikState);
    } else {
      const seq = randomPyraminxScramble(12);
      pyraminxState = Pyraminx.solved().apply(seq).state;
      activeRenderer.setState(pyraminxState);
    }
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
    durBase = 620 - (Number(speedInput.value) - 1) * 60;
  };
  durBase = 620 - 4 * 60;
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

function randomPyraminxScramble(n: number): string {
  const bigMoves = ['U', 'L', 'R', 'B'];
  const smallMoves = ['u', 'l', 'r', 'b'];
  const mods = ['', "'"];
  const out: string[] = [];
  let last = '';
  for (let i = 0; i < n; i++) {
    let f = bigMoves[Math.floor(Math.random() * 4)];
    while (f === last) f = bigMoves[Math.floor(Math.random() * 4)];
    out.push(f + mods[Math.floor(Math.random() * 2)]);
    last = f;
  }
  smallMoves.forEach((s) => {
    if (Math.random() < 0.6) {
      out.push(s + mods[Math.floor(Math.random() * 2)]);
    }
  });
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

function validate3x3(facelet: string): ValidationResult {
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

function validatePyraminx(stateStr: string): ValidationResult {
  const counts: Partial<Record<string, number>> = {};
  for (let i = 0; i < 36; i++) {
    const ch = stateStr[i];
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const emptyCount = counts['.'] ?? 0;
  if (emptyCount > 0) return { ok: false, error: t('err.emptyTilesTpl', emptyCount) };

  const colors = ['Y', 'R', 'G', 'B'];
  const bad = colors.filter((c) => counts[c] !== 9);
  if (bad.length > 0) {
    return { ok: false, error: t('err.wrongCountTpl', bad.join(', ')) };
  }

  return { ok: true };
}

// ================= giải =================

function selectedMethod(): 'kociemba' | 'lbl' | 'pyraminx' {
  const el = document.querySelector<HTMLInputElement>('input[name="method"]:checked');
  if (!el) throw new Error('Không tìm thấy lựa chọn phương pháp giải');
  return el.value as 'kociemba' | 'lbl' | 'pyraminx';
}

function onSolve(): void {
  if (activeMode === '3x3') {
    const facelet = rubikState.join('');
    const v = validate3x3(facelet);
    if (!v.ok) { msg('⚠️ ' + v.error, 'err'); return; }
    const method = selectedMethod();

    if (method === 'kociemba') {
      msg(t('msg.preparingSolver'), 'info');
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
        const res = solveLBL(assertFaceletState(rubikState));
        if (!res.solved) { msg(t('msg.lblInternalError'), 'err'); return; }
        startPlayback(res.stages, res.moves, 'lbl');
      } catch (e) {
        msg(t('msg.solveFailedPrefix') + errorMessage(e), 'err');
      }
    }
  } else {
    // Giải Pyraminx
    const stateStr = pyraminxState.join('');
    const v = validatePyraminx(stateStr);
    if (!v.ok) { msg('⚠️ ' + v.error, 'err'); return; }

    try {
      const res = solvePyraminx(pyraminxState as PyraminxColor[]);
      if (!res.solved) { msg('⚠️ Lỗi không thể giải.', 'err'); return; }
      startPlayback(res.stages, res.moves, 'pyraminx');
    } catch (e) {
      msg(t('msg.solveFailedPrefix') + errorMessage(e), 'err');
    }
  }
}

// ================= phát lại =================

type SolveMethod = 'kociemba' | 'lbl' | 'pyraminx';
let lastSolveMethod: SolveMethod | null = null;

function startPlayback(stg: readonly SolveStage[], moves: readonly Move[], method: SolveMethod): void {
  stages = stg;
  allMoves = moves;
  lastSolveMethod = method;
  
  if (activeMode === '3x3') {
    baseState3x3 = assertFaceletState(rubikState);
  } else {
    baseStatePyra = pyraminxState.slice() as PyraminxColor[];
  }
  idx = 0;

  stageBounds = [];
  let acc = 0;
  for (const s of stages) {
    stageBounds.push({ name: s.name, start: acc, end: acc + s.moves.length });
    acc += s.moves.length;
  }

  inputMode = false;
  activeRenderer.pickEnabled = false;
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
  if (lastSolveMethod === 'kociemba') {
    $('solveInfo').textContent = t('solveInfo.kociembaTpl', allMoves.length);
  } else if (lastSolveMethod === 'lbl') {
    $('solveInfo').textContent = t('solveInfo.lblTpl', allMoves.length, stages.length);
  } else {
    $('solveInfo').textContent = t('solveInfo.pyraminxTpl', allMoves.length);
  }
}

function backToEdit(): void {
  stopPlay();
  inputMode = true;
  activeRenderer.pickEnabled = true;
  
  if (activeMode === '3x3') {
    activeRenderer.setState(rubikState);
  } else {
    activeRenderer.setState(pyraminxState);
  }
  
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
  idx = Math.max(0, Math.min(allMoves.length, k));
  if (activeMode === '3x3') {
    if (!baseState3x3) return;
    const c = new Cube(baseState3x3);
    c.apply(allMoves.slice(0, idx));
    activeRenderer.setState(c.state);
  } else {
    if (!baseStatePyra) return;
    const c = new Pyraminx(baseStatePyra);
    const resCube = c.apply(allMoves.slice(0, idx).join(' '));
    activeRenderer.setState(resCube.state);
  }
  updateUI();
}

function stepNext(cb?: () => void): void {
  if (idx >= allMoves.length || activeRenderer.animating) { cb?.(); return; }
  const m = allMoves[idx];
  activeRenderer.animateMove(m, durBase, () => { idx++; updateUI(); cb?.(); });
}


function stepPrev(): void {
  if (idx <= 0 || activeRenderer.animating) return;
  
  let invM: Move;
  if (activeMode === '3x3') {
    invM = Cube.invertSeq([allMoves[idx - 1]])[0];
  } else {
    invM = inversePyraminxMove(allMoves[idx - 1]);
  }
  
  activeRenderer.animateMove(invM, durBase, () => { idx--; updateUI(); });
}

function startPlay(fast = false): void {
  if (idx >= allMoves.length) seek(0);
  playing = true;
  updateUI();
  const loop = (): void => {
    if (!playing || idx >= allMoves.length) { playing = false; updateUI(); return; }
    const m = allMoves[idx];
    const d = fast ? 90 : durBase;
    activeRenderer.animateMove(m, d, () => { idx++; updateUI(); if (playing) loop(); });
  };
  loop();
}

function stopPlay(): void {
  playing = false;
  updateUI();
}

window.addEventListener('DOMContentLoaded', init);
