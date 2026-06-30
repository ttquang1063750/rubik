/*
 * cube.js — Lõi mô hình Rubik 3x3.
 *
 * - Trạng thái (state): mảng 54 ký tự thuộc {U,R,F,D,L,B} theo thứ tự facelet
 *   chuẩn URFDLB (giống cubejs), mỗi mặt 9 ô đánh số 0..8 theo hàng.
 * - Bảng hoán vị cho 18 nước đi (U U' U2 R ... ) được SINH TỰ ĐỘNG từ hình học
 *   của khối, rồi đối chiếu với cubejs để chắc chắn đúng quy ước.
 * - Đồng thời cung cấp toạ độ 3D + pháp tuyến của từng facelet để dựng khối 3D.
 *
 * Chạy được cả trên trình duyệt (window.RubikCube) lẫn Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RubikCube = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var OFFSET = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

  // Toạ độ cubie (x,y,z ∈ {-1,0,1}) và pháp tuyến cho facelet thứ idx (0..8) của 1 mặt.
  // r = hàng (0 trên), c = cột (0 trái) theo bố cục net chuẩn.
  function faceletGeometry(face, idx) {
    var r = Math.floor(idx / 3), c = idx % 3;
    switch (face) {
      case 'U': return { pos: [c - 1, 1, r - 1], n: [0, 1, 0] };
      case 'R': return { pos: [1, 1 - r, 1 - c], n: [1, 0, 0] };
      case 'F': return { pos: [c - 1, 1 - r, 1], n: [0, 0, 1] };
      case 'D': return { pos: [c - 1, -1, 1 - r], n: [0, -1, 0] };
      case 'L': return { pos: [-1, 1 - r, c - 1], n: [-1, 0, 0] };
      case 'B': return { pos: [1 - c, 1 - r, -1], n: [0, 0, -1] };
    }
  }

  // Danh sách 54 sticker: {index, pos:[x,y,z], n:[..], center:[..]}
  var STICKERS = (function () {
    var arr = [];
    FACES.forEach(function (face) {
      for (var i = 0; i < 9; i++) {
        var g = faceletGeometry(face, i);
        arr.push({
          index: OFFSET[face] + i,
          face: face,
          faceIdx: i,
          pos: g.pos,
          n: g.n,
          center: [g.pos[0] + 0.5 * g.n[0], g.pos[1] + 0.5 * g.n[1], g.pos[2] + 0.5 * g.n[2]]
        });
      }
    });
    return arr;
  })();

  function rotatePoint(p, axis, deg) {
    var a = (deg * Math.PI) / 180, ca = Math.round(Math.cos(a)), sa = Math.round(Math.sin(a));
    var x = p[0], y = p[1], z = p[2];
    if (axis === 'x') return [x, y * ca - z * sa, y * sa + z * ca];
    if (axis === 'y') return [x * ca + z * sa, y, -x * sa + z * ca];
    return [x * ca - y * sa, x * sa + y * ca, z]; // z
  }

  var AXIS_INDEX = { x: 0, y: 1, z: 2 };

  // Sinh hoán vị cho 1 lượt xoay 90°: perm[dest] = src
  function generatePerm(axis, layer, deg) {
    var ai = AXIS_INDEX[axis];
    var perm = [];
    for (var i = 0; i < 54; i++) perm[i] = i;
    STICKERS.forEach(function (s) {
      if (s.pos[ai] !== layer) return;
      var nc = rotatePoint(s.center, axis, deg);
      // tìm sticker đích có center trùng
      for (var j = 0; j < STICKERS.length; j++) {
        var t = STICKERS[j];
        if (Math.abs(t.center[0] - nc[0]) < 1e-6 &&
            Math.abs(t.center[1] - nc[1]) < 1e-6 &&
            Math.abs(t.center[2] - nc[2]) < 1e-6) {
          perm[t.index] = s.index;
          return;
        }
      }
    });
    return perm;
  }

  // Định nghĩa lớp xoay cho mỗi mặt cơ bản (chiều kim đồng hồ sẽ chốt qua kiểm thử).
  var MOVE_DEF = {
    U: { axis: 'y', layer: 1, deg: -90 },
    D: { axis: 'y', layer: -1, deg: 90 },
    R: { axis: 'x', layer: 1, deg: -90 },
    L: { axis: 'x', layer: -1, deg: 90 },
    F: { axis: 'z', layer: 1, deg: -90 },
    B: { axis: 'z', layer: -1, deg: 90 }
  };

  // Bảng hoán vị cho 18 nước.
  var PERMS = {};
  Object.keys(MOVE_DEF).forEach(function (m) {
    var d = MOVE_DEF[m];
    var cw = generatePerm(d.axis, d.layer, d.deg);
    PERMS[m] = cw;
    PERMS[m + "'"] = invertPerm(cw);
    PERMS[m + '2'] = composePerm(cw, cw);
  });

  function invertPerm(p) {
    var inv = [];
    for (var i = 0; i < 54; i++) inv[p[i]] = i;
    return inv;
  }
  // (a then b): áp a trước rồi b. new[dest]=old[ a[ b[dest] ] ]
  function composePerm(a, b) {
    var r = [];
    for (var i = 0; i < 54; i++) r[i] = a[b[i]];
    return r;
  }

  function applyPermStr(state, perm) {
    var out = new Array(54);
    for (var i = 0; i < 54; i++) out[i] = state[perm[i]];
    return out;
  }

  // ---- Cube API ----
  function solvedState() {
    var s = [];
    FACES.forEach(function (f) { for (var i = 0; i < 9; i++) s.push(f); });
    return s;
  }

  function Cube(state) {
    this.state = state ? state.slice() : solvedState();
  }
  Cube.FACES = FACES;
  Cube.OFFSET = OFFSET;
  Cube.STICKERS = STICKERS;
  Cube.MOVE_DEF = MOVE_DEF;
  Cube.PERMS = PERMS;
  Cube.solved = function () { return new Cube(); };

  Cube.prototype.clone = function () { return new Cube(this.state); };
  Cube.prototype.toString = function () { return this.state.join(''); };
  Cube.prototype.isSolved = function () {
    for (var i = 0; i < 6; i++) {
      var c = this.state[i * 9 + 4];
      for (var j = 0; j < 9; j++) if (this.state[i * 9 + j] !== c) return false;
    }
    return true;
  };

  // Áp 1 nước (vd "R", "U'", "F2")
  Cube.prototype.move = function (m) {
    var p = PERMS[m];
    if (!p) throw new Error('Nước không hợp lệ: ' + m);
    this.state = applyPermStr(this.state, p);
    return this;
  };
  // Áp 1 chuỗi nước "R U R' U'"
  Cube.prototype.apply = function (seq) {
    parseMoves(seq).forEach(function (m) { this.move(m); }, this);
    return this;
  };

  function parseMoves(seq) {
    if (Array.isArray(seq)) return seq;
    return seq.trim().length ? seq.trim().split(/\s+/) : [];
  }
  Cube.parseMoves = parseMoves;

  // Rút gọn chuỗi nước: gộp các nước cùng mặt liền nhau (U U -> U2, U U' -> bỏ...)
  var AMOUNT = { '': 1, '2': 2, "'": 3 };
  var AMOUNT_INV = { 1: '', 2: '2', 3: "'" };
  function simplify(seq) {
    var mv = parseMoves(seq).slice();
    var changed = true;
    while (changed) {
      changed = false;
      var out = [];
      for (var i = 0; i < mv.length; i++) {
        if (out.length && out[out.length - 1][0] === mv[i][0]) {
          var prev = out.pop();
          var amt = (AMOUNT[prev.slice(1)] + AMOUNT[mv[i].slice(1)]) % 4;
          if (amt !== 0) out.push(prev[0] + AMOUNT_INV[amt]);
          changed = true;
        } else {
          out.push(mv[i]);
        }
      }
      mv = out;
    }
    return mv;
  }
  Cube.simplify = simplify;

  function invertSeq(seq) {
    var mv = parseMoves(seq).slice().reverse();
    return mv.map(function (m) {
      if (m.length === 1) return m + "'";
      if (m[1] === "'") return m[0];
      return m; // x2
    });
  }
  Cube.invertSeq = invertSeq;

  return Cube;
});
