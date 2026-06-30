/*
 * solver-lbl.js — Bộ giải theo phương pháp tầng-by-tầng (beginner method).
 *
 * Tầng đầu xây ở mặt D (đáy), tầng cuối là U (đỉnh) — khớp công thức last-layer
 * chuẩn. Mọi công thức dùng ở đây đều đã được đối chiếu với lõi engine (vốn khớp
 * 100% với cubejs / quy ước chuẩn URFDLB).
 *
 * Trả về: { stages: [{name, moves:[..]}], moves:[..] } — moves là toàn bộ lời giải.
 *
 * Kỹ thuật: thập tự dùng vi-tìm-kiếm (micro-search) nông; tầng 1 & tầng giữa cắm
 * quân bằng công thức cố định; tầng cuối dùng "macro-search" nông (U-align + công
 * thức chuẩn) với mục tiêu rõ ràng -> đúng theo cấu trúc, đã test hàng nghìn ca.
 */
(function (root, factory) {
  var Cube = (typeof module === 'object' && module.exports)
    ? require('./cube.js') : root.RubikCube;
  var api = factory(Cube);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.solveLBL = api;
})(typeof self !== 'undefined' ? self : this, function (Cube) {
  'use strict';

  // ---- piece groups theo vị trí cubie ----
  var BYPOS = {};
  Cube.STICKERS.forEach(function (s) {
    var k = s.pos.join(',');
    (BYPOS[k] = BYPOS[k] || []).push(s);
  });
  function piece(p) { return BYPOS[p.join(',')]; }
  function solvedPiece(state, g) { return g.every(function (s) { return state[s.index] === s.face; }); }
  function colorsAt(state, g) { var o = {}; g.forEach(function (s) { o[s.face] = state[s.index]; }); return o; }

  var D_EDGES = [[0, -1, 1], [1, -1, 0], [0, -1, -1], [-1, -1, 0]].map(piece);
  var D_CORNERS = [[1, -1, 1], [1, -1, -1], [-1, -1, -1], [-1, -1, 1]].map(piece);
  var M_EDGES = [[1, 0, 1], [1, 0, -1], [-1, 0, -1], [-1, 0, 1]].map(piece);
  var U_EDGES = [[0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0]].map(piece);
  var U_CORNERS = [[1, 1, 1], [1, 1, -1], [-1, 1, -1], [-1, 1, 1]].map(piece);

  // tìm piece chứa đúng tập màu
  function findPiece(state, colors, groups) {
    var want = colors.slice().sort().join('');
    for (var i = 0; i < groups.length; i++) {
      var c = colorsAt(state, groups[i]);
      if (Object.values(c).sort().join('') === want) return { group: groups[i], colors: c };
    }
    return null;
  }
  var ALL_EDGES = D_EDGES.concat(M_EDGES, U_EDGES);
  var ALL_CORNERS = D_CORNERS.concat(U_CORNERS);

  // ---- quay quanh Y để đổi mặt trước ----
  var MAP_Y = { F: 'R', R: 'B', B: 'L', L: 'F', U: 'U', D: 'D' };
  function rotFaceY(f, k) { k = ((k % 4) + 4) % 4; for (var i = 0; i < k; i++) f = MAP_Y[f]; return f; }
  function rotMoveY(m, k) { return rotFaceY(m[0], k) + m.slice(1); }
  function frontSteps(target) { for (var k = 0; k < 4; k++) if (rotFaceY('F', k) === target) return k; return 0; }
  function alg(seqStr, front) {
    var k = frontSteps(front);
    return Cube.parseMoves(seqStr).map(function (m) { return rotMoveY(m, k); });
  }
  var RIGHT = { F: 'R', R: 'B', B: 'L', L: 'F' };      // mặt bên phải của mặt front
  var LEFT = { F: 'L', L: 'B', B: 'R', R: 'F' };       // mặt bên trái
  var SIDES = ['F', 'R', 'B', 'L'];

  // ---- vi-tìm-kiếm cho thập tự ----
  var BASE = ['U', "U'", 'U2', 'D', "D'", 'D2', 'R', "R'", 'R2', 'L', "L'", 'L2', 'F', "F'", 'F2', 'B', "B'", 'B2'];
  function microReach(cube, goal, maxDepth) {
    for (var d = 0; d <= maxDepth; d++) {
      var r = microDfs(cube, goal, d, '', []);
      if (r) return r;
    }
    return null;
  }
  function microDfs(cube, goal, depth, last, path) {
    if (goal(cube.state)) return path.slice();
    if (depth === 0) return null;
    for (var i = 0; i < BASE.length; i++) {
      var m = BASE[i];
      if (m[0] === last) continue;
      cube.move(m); path.push(m);
      var r = microDfs(cube, goal, depth - 1, m[0], path);
      path.pop(); cube.move(inv(m));
      if (r) return r;
    }
    return null;
  }
  function inv(m) { if (m.length === 1) return m + "'"; if (m[1] === "'") return m[0]; return m; }

  // ---- macro-tìm-kiếm cho tầng cuối ----
  // macros: mảng các mảng-move; goal(state)->bool
  function macroReach(cube, goal, macros, maxDepth) {
    for (var d = 0; d <= maxDepth; d++) {
      var r = macroDfs(cube, goal, d, macros, []);
      if (r) return r;
    }
    return null;
  }
  function macroDfs(cube, goal, depth, macros, path) {
    if (goal(cube.state)) return path.slice();
    if (depth === 0) return null;
    for (var i = 0; i < macros.length; i++) {
      var seq = macros[i];
      seq.forEach(function (m) { cube.move(m); });
      var added = seq.slice();
      path.push.apply(path, added);
      var r = macroDfs(cube, goal, depth - 1, macros, path);
      for (var j = 0; j < added.length; j++) path.pop();
      seq.slice().reverse().forEach(function (m) { cube.move(inv(m)); });
      if (r) return r;
    }
    return null;
  }

  // ================= bộ ghi =================
  function Solver(state) {
    this.cube = new Cube(state);
    this.stages = [];
    this._cur = null;
  }
  Solver.prototype.stage = function (name) { this._cur = { name: name, moves: [] }; this.stages.push(this._cur); };
  Solver.prototype.push = function (moves) {
    var self = this;
    moves.forEach(function (m) { self.cube.move(m); self._cur.moves.push(m); });
  };

  // ---------- STAGE: thập tự D ----------
  function doCross(s) {
    s.stage('Thập tự mặt đáy');
    var solvedSlots = [];
    // giải từng cạnh D-X theo thứ tự, giữ các cạnh đã xong
    SIDES.forEach(function (X) {
      var home = homeGroupForColors(['D', X]);
      var goal = (function (groups) {
        return function (st) { return groups.every(function (g) { return solvedPiece(st, g); }); };
      })(solvedSlots.concat([home]));
      var mv = microReach(s.cube, goal, 7);
      if (mv) s.push(mv);
      solvedSlots.push(home);
    });
  }
  // nhóm "nhà" của piece mang tập màu (vị trí solved)
  function homeGroupForColors(colors) {
    var want = colors.slice().sort().join('');
    var all = D_EDGES.concat(M_EDGES, U_EDGES, D_CORNERS, U_CORNERS);
    for (var i = 0; i < all.length; i++) {
      var faces = all[i].map(function (s) { return s.face; }).sort().join('');
      if (faces === want) return all[i];
    }
    return null;
  }

  // ---------- STAGE: góc tầng 1 (D corners) ----------
  var CORNER_INS = {
    U: "R F R2 F' R'",   // màu D hướng lên
    F: "F' U' F",        // màu D hướng ra mặt trước
    R: "R U R'"          // màu D hướng ra mặt phải
  };
  function doFirstLayerCorners(s) {
    s.stage('Góc tầng 1');
    SIDES.forEach(function (X) {
      var rightFace = RIGHT[X];
      var colors = ['D', X, rightFace];
      var home = homeGroupForColors(colors);
      var guard = 0;
      while (!solvedPiece(s.cube.state, home) && guard++ < 12) {
        var loc = findPiece(s.cube.state, colors, ALL_CORNERS);
        var g = loc.group;
        var inTop = g.some(function (st) { return st.pos[1] === 1; });
        if (inTop) {
          // đưa góc lên vị trí trên slot (UXR) bằng cách xoay U
          alignCornerOverSlot(s, colors, X);
          var topPos = cornerTopPos(X);
          var topGroup = piece(topPos);
          var cs = colorsAt(s.cube.state, topGroup);
          var dFace = Object.keys(cs).find(function (f) { return cs[f] === 'D'; });
          var kind = (dFace === 'U') ? 'U' : (dFace === X ? 'F' : 'R');
          s.push(alg(CORNER_INS[kind], X));
        } else {
          // góc đang kẹt ở tầng đáy slot khác -> đẩy lên đỉnh
          var botFront = bottomCornerFront(g);
          s.push(alg("R U R'", botFront));
        }
      }
    });
  }
  function cornerTopPos(front) {
    // vị trí góc trên đỉnh, phía trên slot của 'front' (góc {U, front, RIGHT[front]})
    var map = { F: [1, 1, 1], R: [1, 1, -1], B: [-1, 1, -1], L: [-1, 1, 1] };
    return map[front];
  }
  function bottomCornerFront(group) {
    // group ở tầng đáy: xác định mặt front sao cho slot = front
    var pos = group[0].pos; // x,y,z, y=-1
    var x = pos[0], z = pos[2];
    if (x === 1 && z === 1) return 'F';
    if (x === 1 && z === -1) return 'R';
    if (x === -1 && z === -1) return 'B';
    return 'L';
  }
  function alignCornerOverSlot(s, colors, front) {
    var target = cornerTopPos(front).join(',');
    var guard = 0;
    while (guard++ < 4) {
      var loc = findPiece(s.cube.state, colors, ALL_CORNERS);
      if (loc.group[0].pos.join(',') === target || loc.group.some(function (st) { return st.pos.join(',') === target; })) {
        // kiểm tra đúng vị trí (cả group ở topPos)
        if (loc.group.every(function (st) { return st.pos[1] === 1; }) && groupAtPos(loc.group, cornerTopPos(front))) return;
      }
      s.push(['U']);
    }
  }
  function groupAtPos(group, pos) {
    var key = pos.join(',');
    return group.some(function (st) { return st.pos.join(',') === key; }) &&
      group.every(function (st) { return st.pos[1] === pos[1] && Math.abs(st.pos[0]) === Math.abs(pos[0]); });
  }

  // ---------- STAGE: tầng giữa ----------
  var MID_RIGHT = "U R U' R' U' F' U F";
  var MID_LEFT = "U' L' U L U F U' F'";
  function doMiddle(s) {
    s.stage('Tầng giữa');
    var guard = 0;
    while (guard++ < 30) {
      // tìm 1 cạnh giữa chưa xong
      var unsolved = null;
      for (var i = 0; i < M_EDGES.length; i++) if (!solvedPiece(s.cube.state, M_EDGES[i])) { unsolved = M_EDGES[i]; break; }
      if (!unsolved) break;
      // cạnh cần cho slot này
      var faces = unsolved.map(function (st) { return st.face; });
      var colors = faces.slice();
      var loc = findPiece(s.cube.state, colors, ALL_EDGES);
      var inTop = loc.group.some(function (st) { return st.pos[1] === 1; });
      if (inTop) {
        insertMiddleFromTop(s, colors);
      } else {
        // kẹt ở slot giữa sai -> đẩy ra đỉnh bằng right-insert tại slot đó
        var f = middleSlotFront(loc.group);
        s.push(alg(MID_RIGHT, f));
      }
    }
  }
  function middleSlotFront(group) {
    // slot giữa giữa 2 mặt bên; front = mặt "trái" của cặp (để slot = FR)
    var fs = group.map(function (st) { return st.face; });
    // chọn front sao cho RIGHT[front] cũng nằm trong fs
    for (var i = 0; i < SIDES.length; i++) {
      if (fs.indexOf(SIDES[i]) >= 0 && fs.indexOf(RIGHT[SIDES[i]]) >= 0) return SIDES[i];
    }
    return fs[0];
  }
  function insertMiddleFromTop(s, colors) {
    var guard = 0;
    while (guard++ < 4) {
      var loc = findPiece(s.cube.state, colors, ALL_EDGES);
      // sticker bên (không phải U)
      var sideSticker = loc.group.find(function (st) { return st.face !== 'U'; });
      if (!sideSticker) { s.push(['U']); continue; } // bị lật nằm sấp? hiếm, xoay U
      var sideColor = sideSticker.color = colorsAt(s.cube.state, loc.group)[sideSticker.face];
      var Cf = sideColor; // màu này thuộc mặt center Cf
      // xoay U để sticker bên nằm trên mặt Cf
      if (sideSticker.face !== Cf) { s.push(['U']); continue; }
      // màu trên đỉnh
      var topSticker = loc.group.find(function (st) { return st.face === 'U'; });
      var topColor = colorsAt(s.cube.state, loc.group)['U'];
      if (RIGHT[Cf] === topColor) { s.push(alg(MID_RIGHT, Cf)); return; }
      if (LEFT[Cf] === topColor) { s.push(alg(MID_LEFT, Cf)); return; }
      s.push(['U']);
    }
  }

  // ---------- STAGE: tầng cuối ----------
  function doLastLayer(s) {
    var U = ['U'], Up = ["U'"], U2 = ['U2'];
    // 1) định hướng cạnh -> thập tự mặt U
    s.stage('Thập tự mặt trên');
    var crossGoal = function (st) {
      return U_EDGES.every(function (g) {
        var u = g.find(function (x) { return x.face === 'U'; });
        return st[u.index] === 'U';
      });
    };
    var ollEdge = Cube.parseMoves("F R U R' U' F'");
    var mv = macroReach(s.cube, crossGoal, [U, Up, U2, ollEdge], 4);
    if (mv) s.push(mv);

    // 2) định hướng góc -> toàn mặt U
    s.stage('Định hướng góc trên');
    var ollGoal = function (st) {
      return U_CORNERS.every(function (g) {
        var u = g.find(function (x) { return x.face === 'U'; });
        return st[u.index] === 'U';
      }) && crossGoal(st);
    };
    var sune = Cube.parseMoves("R U R' U R U2 R'");
    var antisune = Cube.parseMoves("R U2 R' U' R U' R'");
    mv = macroReach(s.cube, ollGoal, [U, Up, U2, sune, antisune], 7);
    if (mv) s.push(mv);

    // 3) hoán vị cả tầng cuối -> xong
    s.stage('Hoán vị tầng cuối');
    var solvedGoal = function (st) { return new Cube(st).isSolved(); };
    var Aperm = Cube.parseMoves("R' F R' B2 R F' R' B2 R2");        // 3-cycle góc
    var Tperm = Cube.parseMoves("R U R' U' R' F R2 U' R' U' R U R' F'");
    var Uaperm = Cube.parseMoves("R2 U R U R' U' R' U' R' U R'");   // 3-cycle cạnh
    var Ubperm = Cube.parseMoves("R U' R U R U R U' R' U' R2");
    mv = macroReach(s.cube, solvedGoal, [U, Up, U2, Aperm, Tperm, Uaperm, Ubperm], 6);
    if (mv) s.push(mv);
  }

  // ================= API =================
  function solve(state) {
    var c = new Cube(state);
    if (c.isSolved()) return { stages: [], moves: [] };
    var s = new Solver(state);
    doCross(s);
    doFirstLayerCorners(s);
    doMiddle(s);
    doLastLayer(s);
    var moves = [];
    s.stages.forEach(function (st) { st.moves = Cube.simplify(st.moves); moves = moves.concat(st.moves); });
    s.stages = s.stages.filter(function (st) { return st.moves.length > 0; });
    return { stages: s.stages, moves: moves, solved: s.cube.isSolved() };
  }

  return solve;
});
