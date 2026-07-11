/**
 * Đa ngôn ngữ UI (vi/en). Core (cube/solver) không chứa text hiển thị — chỉ trả
 * về StageKey/Face, UI tự tra tên hiển thị qua đây.
 */
import type { Face, StageKey } from '../core/types';

export type Lang = 'vi' | 'en';

type Key =
  | 'topBar.otherApps'
  | 'topBar.donate'
  | 'tagline'
  | 'stageHintPrefix'
  | 'modeHint.color'
  | 'modeHint.playback'
  | 'inputPanel.heading'
  | 'inputPanel.desc'
  | 'btn.solved'
  | 'btn.scramble'
  | 'btn.clear'
  | 'btn.solve'
  | 'btn.edit'
  | 'btn.fast'
  | 'mode.3x3'
  | 'mode.pyraminx'
  | 'methodPanel.heading'
  | 'method.kociemba.title'
  | 'method.kociemba.desc'
  | 'method.lbl.title'
  | 'method.lbl.desc'
  | 'method.pyraminx.title'
  | 'method.pyraminx.desc'
  | 'playPanel.heading'
  | 'control.first'
  | 'control.prev'
  | 'control.playToggle'
  | 'control.next'
  | 'control.last'
  | 'speed.label'
  | 'movesTitle'
  | 'help.toggle'
  | 'help.U'
  | 'help.D'
  | 'help.F'
  | 'help.B'
  | 'help.R'
  | 'help.L'
  | 'help.note'
  | 'color.U'
  | 'color.D'
  | 'color.F'
  | 'color.B'
  | 'color.R'
  | 'color.L'
  | 'stage.kociembaOptimal'
  | 'stage.cross'
  | 'stage.f1Corners'
  | 'stage.middleEdges'
  | 'stage.topCross'
  | 'stage.topCornersOrient'
  | 'stage.finalPermutation'
  | 'stage.tips'
  | 'stage.centers'
  | 'stage.edges'
  | 'msg.cleared'
  | 'msg.scrambled'
  | 'msg.preparingSolver'
  | 'msg.solveFailedPrefix'
  | 'msg.lblInternalError'
  | 'msg.solvedDone'
  | 'err.duplicateMissing'
  | 'err.cornerTwist'
  | 'err.edgeFlip'
  | 'err.parity'
  | 'err.invalidColors'
  | 'err.emptyTilesTpl'
  | 'err.wrongCountTpl'
  | 'solveInfo.kociembaTpl'
  | 'solveInfo.lblTpl'
  | 'solveInfo.pyraminxTpl';

const VI: Readonly<Record<Key, string>> = {
  'topBar.otherApps': 'Ứng dụng khác',
  'topBar.donate': '♥ Ủng hộ',
  tagline: 'Nhập màu từng ô như khối thật → xem cách giải từng bước hoặc giải nhanh',
  stageHintPrefix: 'Kéo để xoay khối · ',
  'modeHint.color': 'Chạm vào ô để tô màu đang chọn',
  'modeHint.playback': 'Đang xem lời giải',
  'inputPanel.heading': '1 · Nhập màu',
  'inputPanel.desc': 'Chọn một màu rồi chạm vào các ô trên khối. Ô tâm (giữa) đã cố định.',
  'btn.solved': 'Mẫu đã giải',
  'btn.scramble': 'Trộn ngẫu nhiên',
  'btn.clear': 'Xoá hết',
  'btn.solve': 'Giải khối này ▶',
  'btn.edit': '← Sửa màu',
  'btn.fast': 'Giải nhanh ⏩',
  'mode.3x3': 'Khối 3x3',
  'mode.pyraminx': 'Kim tự tháp (Pyraminx)',
  'methodPanel.heading': '2 · Cách giải',
  'method.kociemba.title': 'Nhanh / ngắn gọn',
  'method.kociemba.desc': 'Thuật toán Kociemba (~20 nước)',
  'method.lbl.title': 'Người mới (từng tầng)',
  'method.lbl.desc': 'Có tên từng giai đoạn, dễ học',
  'method.pyraminx.title': 'Tối ưu / Ngắn nhất',
  'method.pyraminx.desc': 'BFS hai đầu tìm lời giải tối ưu',
  'playPanel.heading': 'Lời giải',
  'control.first': 'Về đầu',
  'control.prev': 'Lùi',
  'control.playToggle': 'Chạy/Dừng',
  'control.next': 'Tiến',
  'control.last': 'Tới cuối',
  'speed.label': 'Tốc độ',
  movesTitle: 'Toàn bộ các bước',
  'help.toggle': 'Giải thích ký hiệu',
  'help.U': 'Mặt trên',
  'help.D': 'Mặt dưới',
  'help.F': 'Mặt trước',
  'help.B': 'Mặt sau',
  'help.R': 'Mặt phải',
  'help.L': 'Mặt trái',
  'help.note': "Xoay mặt đó 90° theo chiều kim đồng hồ (nhìn thẳng vào mặt). Thêm dấu ' = ngược chiều kim đồng hồ, thêm số 2 = xoay 180°.",
  'color.U': 'Trắng',
  'color.D': 'Vàng',
  'color.F': 'Xanh lá',
  'color.B': 'Xanh dương',
  'color.R': 'Đỏ',
  'color.L': 'Cam',
  'stage.kociembaOptimal': 'Lời giải tối ưu (Kociemba)',
  'stage.cross': 'Thập tự mặt đáy',
  'stage.f1Corners': 'Góc tầng 1',
  'stage.middleEdges': 'Tầng giữa',
  'stage.topCross': 'Thập tự mặt trên',
  'stage.topCornersOrient': 'Định hướng góc trên',
  'stage.finalPermutation': 'Hoán vị tầng cuối',
  'stage.tips': 'Giải chóp đỉnh',
  'stage.centers': 'Giải góc chính (tâm)',
  'stage.edges': 'Giải cạnh',
  'msg.cleared': 'Đã xoá. Hãy tô lại các ô theo khối của bạn.',
  'msg.scrambled': 'Đã trộn ngẫu nhiên 25 nước.',
  'msg.preparingSolver': '⏳ Đang chuẩn bị bộ giải nhanh…',
  'msg.solveFailedPrefix': 'Không giải được: ',
  'msg.lblInternalError': 'Lỗi nội bộ khi giải tầng-by-tầng.',
  'msg.solvedDone': '✅ Đã giải xong!',
  'err.duplicateMissing': 'Có quân bị trùng/thiếu — kiểm tra lại màu.',
  'err.cornerTwist': 'Một góc bị xoay sai hướng (không thể có thật).',
  'err.edgeFlip': 'Một cạnh bị lật sai hướng (không thể có thật).',
  'err.parity': 'Trạng thái không thể giải (sai 2 quân).',
  'err.invalidColors': 'Màu không hợp lệ — kiểm tra lại.',
  'err.emptyTilesTpl': 'Còn {0} ô chưa tô màu.',
  'err.wrongCountTpl': 'Mỗi màu phải đúng 9 ô. Sai ở: {0}.',
  'solveInfo.kociembaTpl': '{0} nước · thuật toán Kociemba',
  'solveInfo.lblTpl': '{0} nước · {1} giai đoạn',
  'solveInfo.pyraminxTpl': '{0} nước · lời giải tối ưu Pyraminx'
};

const EN: Readonly<Record<Key, string>> = {
  'topBar.otherApps': 'Other apps',
  'topBar.donate': '♥ Donate',
  tagline: 'Color each tile like a real cube → see the step-by-step solution or fast-solve',
  stageHintPrefix: 'Drag to rotate · ',
  'modeHint.color': 'Tap a tile to paint it',
  'modeHint.playback': 'Viewing solution',
  'inputPanel.heading': '1 · Enter colors',
  'inputPanel.desc': 'Pick a color, then tap tiles on the cube. Center tiles are fixed.',
  'btn.solved': 'Solved sample',
  'btn.scramble': 'Random scramble',
  'btn.clear': 'Clear all',
  'btn.solve': 'Solve this cube ▶',
  'btn.edit': '← Edit colors',
  'btn.fast': 'Fast-solve ⏩',
  'mode.3x3': '3x3x3 Cube',
  'mode.pyraminx': 'Pyraminx',
  'methodPanel.heading': '2 · Solving method',
  'method.kociemba.title': 'Fast / short',
  'method.kociemba.desc': 'Kociemba algorithm (~20 moves)',
  'method.lbl.title': 'Beginner (layer by layer)',
  'method.lbl.desc': 'Named stages, easy to learn',
  'method.pyraminx.title': 'Optimal / Shortest',
  'method.pyraminx.desc': 'Bidirectional BFS optimal solver',
  'playPanel.heading': 'Solution',
  'control.first': 'First',
  'control.prev': 'Previous',
  'control.playToggle': 'Play/Pause',
  'control.next': 'Next',
  'control.last': 'Last',
  'speed.label': 'Speed',
  movesTitle: 'All moves',
  'help.toggle': 'Notation help',
  'help.U': 'Top face',
  'help.D': 'Bottom face',
  'help.F': 'Front face',
  'help.B': 'Back face',
  'help.R': 'Right face',
  'help.L': 'Left face',
  'help.note': "Turns that face 90° clockwise (looking straight at it). Add ' for counter-clockwise, add 2 for a 180° turn.",
  'color.U': 'White',
  'color.D': 'Yellow',
  'color.F': 'Green',
  'color.B': 'Blue',
  'color.R': 'Red',
  'color.L': 'Orange',
  'stage.kociembaOptimal': 'Optimal solution (Kociemba)',
  'stage.cross': 'Bottom cross',
  'stage.f1Corners': 'First layer corners',
  'stage.middleEdges': 'Middle layer',
  'stage.topCross': 'Top cross',
  'stage.topCornersOrient': 'Orient top corners',
  'stage.finalPermutation': 'Permute last layer',
  'stage.tips': 'Solve tips',
  'stage.centers': 'Solve centers (axial corners)',
  'stage.edges': 'Solve edges',
  'msg.cleared': 'Cleared. Repaint the tiles to match your cube.',
  'msg.scrambled': 'Scrambled with 25 random moves.',
  'msg.preparingSolver': '⏳ Preparing the fast solver…',
  'msg.solveFailedPrefix': 'Could not solve: ',
  'msg.lblInternalError': 'Internal error in the layer-by-layer solver.',
  'msg.solvedDone': '✅ Solved!',
  'err.duplicateMissing': 'Duplicate or missing pieces — check your colors.',
  'err.cornerTwist': 'A corner is twisted incorrectly (impossible state).',
  'err.edgeFlip': 'An edge is flipped incorrectly (impossible state).',
  'err.parity': 'Unsolvable state (two pieces swapped).',
  'err.invalidColors': 'Invalid colors — please check.',
  'err.emptyTilesTpl': '{0} tiles still unpainted.',
  'err.wrongCountTpl': 'Each color must have exactly 9 tiles. Wrong: {0}.',
  'solveInfo.kociembaTpl': '{0} moves · Kociemba algorithm',
  'solveInfo.lblTpl': '{0} moves · {1} stages',
  'solveInfo.pyraminxTpl': '{0} moves · Pyraminx optimal solver'
};

const DICTS: Readonly<Record<Lang, Readonly<Record<Key, string>>>> = { vi: VI, en: EN };

const STORAGE_KEY = 'rubik-lang';

function detectInitialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'en' ? 'en' : 'vi';
}

let currentLang: Lang = detectInitialLang();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
}

export function t(key: Key, ...args: ReadonlyArray<string | number>): string {
  const template = DICTS[currentLang][key];
  if (args.length === 0) return template;
  return template.replace(/\{(\d+)\}/g, (_match, i: string) => String(args[Number(i)] ?? ''));
}

export function isI18nKey(key: string): key is Key {
  return Object.prototype.hasOwnProperty.call(VI, key);
}

const STAGE_LABEL_KEY: Readonly<Record<StageKey, Key>> = {
  kociembaOptimal: 'stage.kociembaOptimal',
  cross: 'stage.cross',
  f1Corners: 'stage.f1Corners',
  middleEdges: 'stage.middleEdges',
  topCross: 'stage.topCross',
  topCornersOrient: 'stage.topCornersOrient',
  finalPermutation: 'stage.finalPermutation',
  tips: 'stage.tips',
  centers: 'stage.centers',
  edges: 'stage.edges'
};

export function stageLabel(stage: StageKey): string {
  return t(STAGE_LABEL_KEY[stage]);
}

const COLOR_LABEL_KEY: Readonly<Record<Face | 'Y' | 'G', Key>> = {
  U: 'color.U',
  D: 'color.D',
  F: 'color.F',
  B: 'color.B',
  R: 'color.R',
  L: 'color.L',
  Y: 'color.D',
  G: 'color.F'
};

export function colorLabel(face: Face | 'Y' | 'G'): string {
  return t(COLOR_LABEL_KEY[face]);
}
