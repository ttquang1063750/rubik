/*
 * app.js — Kết nối UI: nhập màu trên khối 3D, kiểm tra hợp lệ, gọi bộ giải, phát lại.
 */
(function () {
  'use strict';
  var Cube = window.RubikCube;
  var COLORS = window.RubikRenderer.COLORS;

  // ---- bảng màu: thứ tự đẹp mắt, kèm ký tự mặt ----
  var PALETTE = [
    { letter: 'U', name: 'Trắng' },
    { letter: 'D', name: 'Vàng' },
    { letter: 'F', name: 'Xanh lá' },
    { letter: 'B', name: 'Xanh dương' },
    { letter: 'R', name: 'Đỏ' },
    { letter: 'L', name: 'Cam' }
  ];
  var CENTERS = [4, 13, 22, 31, 40, 49];
  var EMPTY = '.';

  // ---- trạng thái ----
  var state = Cube.solved().state.slice();
  var selected = 'U';
  var inputMode = true;
  var renderer;

  // playback
  var baseState = null, allMoves = [], stages = [], stageBounds = [], idx = 0;
  var playing = false, durBase = 320;

  // ---- elements ----
  var $ = function (id) { return document.getElementById(id); };

  function init() {
    renderer = new window.RubikRenderer($('cube3d'));
    renderer.setState(state);
    renderer.pickEnabled = true;
    renderer.onPick = function (i) {
      if (!inputMode) return;
      if (CENTERS.indexOf(i) >= 0) return;       // không sửa ô tâm
      state[i] = selected;
      renderer.setState(state);
    };
    buildPalette();
    bindButtons();
  }

  function buildPalette() {
    var pal = $('palette');
    PALETTE.forEach(function (p) {
      var sw = document.createElement('div');
      sw.className = 'swatch' + (p.letter === selected ? ' active' : '');
      sw.style.background = COLORS[p.letter];
      sw.title = p.name;
      sw.onclick = function () {
        selected = p.letter;
        Array.prototype.forEach.call(pal.children, function (c) { c.classList.remove('active'); });
        sw.classList.add('active');
      };
      pal.appendChild(sw);
    });
  }

  function bindButtons() {
    $('btnSolved').onclick = function () { setState(Cube.solved().state.slice()); msg('', ''); };
    $('btnClear').onclick = function () {
      var s = []; for (var i = 0; i < 54; i++) s[i] = EMPTY;
      ['U', 'R', 'F', 'D', 'L', 'B'].forEach(function (f, k) { s[CENTERS[k]] = f; });
      setState(s); msg('Đã xoá. Hãy tô lại các ô theo khối của bạn.', 'info');
    };
    $('btnScramble').onclick = function () {
      var seq = randomScramble(25);
      setState(Cube.solved().apply(seq).state.slice());
      msg('Đã trộn ngẫu nhiên 25 nước.', 'info');
    };
    $('btnSolve').onclick = onSolve;
    $('btnEdit').onclick = backToEdit;

    $('btnFirst').onclick = function () { stopPlay(); seek(0); };
    $('btnLast').onclick = function () { stopPlay(); seek(allMoves.length); };
    $('btnPrev').onclick = function () { stopPlay(); stepPrev(); };
    $('btnNext').onclick = function () { stopPlay(); stepNext(); };
    $('btnPlay').onclick = function () { playing ? stopPlay() : startPlay(); };
    $('btnFast').onclick = function () { startPlay(true); };
    $('speed').oninput = function () {
      durBase = 620 - (this.value - 1) * 60;   // 1->620ms, 10->80ms
    };
    durBase = 620 - (4) * 60;
  }

  function setState(s) {
    state = s.slice();
    renderer.setState(state);
  }

  function msg(text, kind) {
    var m = $('msg');
    m.textContent = text;
    m.className = 'msg ' + (kind || '');
  }

  function randomScramble(n) {
    var f = ['U', 'R', 'F', 'D', 'L', 'B'], md = ['', "'", '2'], out = [];
    for (var i = 0; i < n; i++) out.push(f[Math.random() * 6 | 0] + md[Math.random() * 3 | 0]);
    return out.join(' ');
  }

  // ================= kiểm tra hợp lệ =================
  function validate(facelet) {
    // đếm màu
    var cnt = {};
    for (var i = 0; i < 54; i++) cnt[facelet[i]] = (cnt[facelet[i]] || 0) + 1;
    if (cnt[EMPTY]) return { ok: false, error: 'Còn ' + cnt[EMPTY] + ' ô chưa tô màu.' };
    var bad = ['U', 'R', 'F', 'D', 'L', 'B'].filter(function (f) { return cnt[f] !== 9; });
    if (bad.length) return { ok: false, error: 'Mỗi màu phải đúng 9 ô. Sai ở: ' + bad.join(', ') + '.' };

    // dùng cubejs để dựng & kiểm tra tính giải được
    try {
      var c = window.Cube.fromString(facelet);
      if (!isPerm(c.cp, 8) || !isPerm(c.ep, 12)) return { ok: false, error: 'Có quân bị trùng/thiếu — kiểm tra lại màu.' };
      var coSum = c.co.reduce(function (a, b) { return a + b; }, 0);
      var eoSum = c.eo.reduce(function (a, b) { return a + b; }, 0);
      if (coSum % 3 !== 0) return { ok: false, error: 'Một góc bị xoay sai hướng (không thể có thật).' };
      if (eoSum % 2 !== 0) return { ok: false, error: 'Một cạnh bị lật sai hướng (không thể có thật).' };
      if (parity(c.cp) !== parity(c.ep)) return { ok: false, error: 'Trạng thái không thể giải (sai 2 quân).' };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Màu không hợp lệ — kiểm tra lại.' };
    }
  }
  function isPerm(arr, n) {
    if (arr.length !== n) return false;
    var seen = {}; for (var i = 0; i < n; i++) { if (arr[i] < 0 || arr[i] >= n || seen[arr[i]]) return false; seen[arr[i]] = 1; }
    return true;
  }
  function parity(arr) {
    var p = 0; for (var i = 0; i < arr.length; i++) for (var j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) p++;
    return p % 2;
  }

  // ================= giải =================
  var solverReady = false;
  function onSolve() {
    var facelet = state.join('');
    var v = validate(facelet);
    if (!v.ok) { msg('⚠️ ' + v.error, 'err'); return; }
    var method = document.querySelector('input[name="method"]:checked').value;

    if (method === 'kociemba') {
      msg('⏳ Đang chuẩn bị bộ giải nhanh…', 'info');
      // initSolver nặng -> chạy sau 1 nhịp để UI kịp hiện thông báo
      setTimeout(function () {
        try {
          if (!solverReady) { window.Cube.initSolver(); solverReady = true; }
          var sol = window.Cube.fromString(facelet).solve();
          var moves = Cube.simplify(sol);
          startPlayback([{ name: 'Lời giải tối ưu (Kociemba)', moves: moves }], moves, facelet,
            moves.length + ' nước · thuật toán Kociemba');
        } catch (e) {
          msg('Không giải được: ' + e.message, 'err');
        }
      }, 30);
    } else {
      try {
        var res = window.solveLBL(state.slice());
        if (!res.solved) { msg('Lỗi nội bộ khi giải tầng-by-tầng.', 'err'); return; }
        startPlayback(res.stages, res.moves, facelet,
          res.moves.length + ' nước · ' + res.stages.length + ' giai đoạn');
      } catch (e) {
        msg('Không giải được: ' + e.message, 'err');
      }
    }
  }

  // ================= phát lại =================
  function startPlayback(stg, moves, facelet, info) {
    stages = stg; allMoves = moves; baseState = state.slice(); idx = 0;
    // mốc giai đoạn
    stageBounds = []; var acc = 0;
    stages.forEach(function (s) { stageBounds.push({ name: s.name, start: acc, end: acc + s.moves.length }); acc += s.moves.length; });

    inputMode = false; renderer.pickEnabled = false;
    $('inputPanel').classList.add('hidden');
    $('playPanel').classList.remove('hidden');
    $('solveInfo').textContent = info;
    $('modeHint').textContent = 'Đang xem lời giải';
    renderMovesList();
    seek(0);
    msg('', '');
  }

  function backToEdit() {
    stopPlay();
    inputMode = true; renderer.pickEnabled = true;
    renderer.setState(state);            // giữ nguyên màu đã nhập
    $('playPanel').classList.add('hidden');
    $('inputPanel').classList.remove('hidden');
    $('modeHint').textContent = 'Chạm vào ô để tô màu đang chọn';
    msg('', '');
  }

  function renderMovesList() {
    var wrap = $('movesList'); wrap.innerHTML = '';
    var gi = 0;
    stages.forEach(function (s, si) {
      var group = document.createElement('div'); group.className = 'stage-group';
      if (stages.length > 1) {
        var name = document.createElement('div'); name.className = 'gname';
        name.textContent = (si + 1) + '. ' + s.name + ' (' + s.moves.length + ')';
        group.appendChild(name);
      }
      var chips = document.createElement('div'); chips.className = 'chips';
      s.moves.forEach(function (m) {
        var chip = document.createElement('span');
        chip.className = 'chip'; chip.textContent = m; chip.dataset.i = gi;
        var captured = gi;
        chip.onclick = function () { stopPlay(); seek(captured + 1); };
        chips.appendChild(chip); gi++;
      });
      group.appendChild(chips); wrap.appendChild(group);
    });
  }

  function updateUI() {
    $('moveCounter').textContent = idx + ' / ' + allMoves.length;
    // giai đoạn hiện tại: tìm giai đoạn chứa nước sắp đi (idx)
    var label = '';
    for (var i = 0; i < stageBounds.length; i++) {
      var b = stageBounds[i];
      if (idx >= b.start && idx < b.end) { label = b.name; break; }
    }
    if (idx >= allMoves.length && allMoves.length) label = '✅ Đã giải xong!';
    $('stageLabel').textContent = label;
    $('btnPlay').textContent = playing ? '⏸' : '▶';
    // chip highlight
    var chips = $('movesList').querySelectorAll('.chip');
    chips.forEach(function (c) {
      var i = +c.dataset.i;
      c.classList.toggle('done', i < idx);
      c.classList.toggle('current', i === idx);
    });
  }

  // nhảy tức thời tới vị trí k (0..N)
  function seek(k) {
    k = Math.max(0, Math.min(allMoves.length, k));
    idx = k;
    var c = new Cube(baseState);
    c.apply(allMoves.slice(0, k));
    renderer.setState(c.state);
    updateUI();
  }

  function stepNext(cb) {
    if (idx >= allMoves.length || renderer.animating) { if (cb) cb(); return; }
    var m = allMoves[idx];
    renderer.animateMove(m, durBase, function () { idx++; updateUI(); if (cb) cb(); });
  }
  function stepPrev() {
    if (idx <= 0 || renderer.animating) return;
    var m = Cube.invertSeq(allMoves[idx - 1])[0];
    renderer.animateMove(m, durBase, function () { idx--; updateUI(); });
  }

  function startPlay(fast) {
    if (idx >= allMoves.length) seek(0);
    playing = true; updateUI();
    var d = fast ? 90 : durBase;
    (function loop() {
      if (!playing || idx >= allMoves.length) { playing = false; updateUI(); return; }
      var m = allMoves[idx];
      renderer.animateMove(m, d, function () { idx++; updateUI(); if (playing) loop(); });
    })();
  }
  function stopPlay() { playing = false; updateUI && updateUI(); }

  window.addEventListener('DOMContentLoaded', init);
})();
