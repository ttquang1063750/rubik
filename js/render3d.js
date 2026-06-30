/*
 * render3d.js — Dựng & hoạt hoạ khối Rubik 3D bằng Three.js.
 *
 * - build(): tạo 26 cubie + 54 sticker (mỗi sticker gắn faceletIndex).
 * - setState(state): tô lại màu từ trạng thái.
 * - animateMove(move, ms, cb): xoay 1 lớp 90° rồi cập nhật.
 * - kéo chuột để xoay toàn khối; click sticker -> onPick(faceletIndex) (chế độ nhập).
 *
 * Phụ thuộc THREE (global, từ vendor/three.min.js) và RubikCube.
 */
(function (root) {
  'use strict';
  var Cube = root.RubikCube;

  // màu hiển thị cho từng ký tự mặt
  var COLORS = {
    U: '#ffffff', D: '#ffd500', F: '#009b48',
    B: '#0046ad', R: '#b71234', L: '#ff5800'
  };
  var CS = 1.0;          // cạnh cubie
  var GAP = 0.06;

  function Renderer(container) {
    this.container = container;
    this.onPick = null;
    this.pickEnabled = false;
    this.animating = false;
    this._init();
    this._build();
    this._bindInput();
    this._animate();
  }

  Renderer.COLORS = COLORS;

  Renderer.prototype._init = function () {
    var w = this.container.clientWidth, h = this.container.clientHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(5.2, 5.0, 6.4);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    this.world = new THREE.Group();   // xoay toàn khối khi kéo chuột
    this.scene.add(this.world);
    // nghiêng nhẹ ban đầu
    this.world.rotation.x = -0.2;
    this.world.rotation.y = -0.5;

    var self = this;
    window.addEventListener('resize', function () { self._resize(); });
  };

  Renderer.prototype._resize = function () {
    var w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  Renderer.prototype._build = function () {
    this.stickerMeshes = [];   // index = faceletIndex
    this.cubies = {};          // key pos -> {group}
    var self = this;

    // thân cubie (đen)
    var bodyGeo = new THREE.BoxGeometry(CS - GAP, CS - GAP, CS - GAP);
    var bodyMat = new THREE.MeshBasicMaterial({ color: 0x101216 });
    for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) {
      if (x === 0 && y === 0 && z === 0) continue;
      var body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(x * CS, y * CS, z * CS);
      body.userData.cubie = [x, y, z];
      this.world.add(body);
    }

    // sticker từ STICKERS
    var stGeo = new THREE.PlaneGeometry(CS - GAP - 0.06, CS - GAP - 0.06);
    Cube.STICKERS.forEach(function (s) {
      var mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      var mesh = new THREE.Mesh(stGeo, mat);
      var p = s.pos, n = s.n;
      mesh.position.set(p[0] * CS + n[0] * (CS / 2 + 0.001),
        p[1] * CS + n[1] * (CS / 2 + 0.001),
        p[2] * CS + n[2] * (CS / 2 + 0.001));
      // hướng mặt theo pháp tuyến
      var normal = new THREE.Vector3(n[0], n[1], n[2]);
      mesh.lookAt(mesh.position.clone().add(normal));
      mesh.userData.faceletIndex = s.index;
      mesh.userData.basePos = mesh.position.clone();
      mesh.userData.baseQuat = mesh.quaternion.clone();
      mesh.userData.cubie = [p[0], p[1], p[2]];
      self.stickerMeshes[s.index] = mesh;
      self.world.add(mesh);
    });
  };

  Renderer.prototype.setState = function (state) {
    this.state = state.slice();
    for (var i = 0; i < 54; i++) {
      var letter = state[i];
      this.stickerMeshes[i].material.color.set(COLORS[letter] || '#333');
    }
  };

  // ---- highlight 1 sticker (chế độ nhập) ----
  Renderer.prototype.flash = function (idx) {
    var m = this.stickerMeshes[idx];
    if (!m) return;
    var old = m.scale.x;
    m.scale.set(1.0, 1.0, 1.0);
  };

  // ================= hoạt hoạ nước đi =================
  var AXIS = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };
  var LAYER = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
  // chiều quay hình học (đồng bộ với MOVE_DEF của engine)
  function moveAngle(move) {
    var face = move[0];
    var base = Cube.MOVE_DEF[face].deg;     // -90 hoặc 90
    var times = move.length === 1 ? 1 : (move[1] === "'" ? -1 : 2);
    return (base * Math.PI / 180) * times;
  }

  Renderer.prototype.animateMove = function (move, ms, cb) {
    if (this.animating) { if (cb) cb(); return; }
    var face = move[0];
    var axis = AXIS[face], layer = LAYER[face];
    var ai = { x: 0, y: 1, z: 2 }[axis];
    var self = this;

    // gom các object thuộc lớp
    var pivot = new THREE.Group();
    this.world.add(pivot);
    var moved = [];
    this.world.children.forEach(function (obj) {
      if (obj === pivot) return;
      var c = obj.userData.cubie;
      if (!c) return;
      if (c[ai] === layer) moved.push(obj);
    });
    moved.forEach(function (obj) { pivot.attach(obj); });

    var target = moveAngle(move);
    var start = performance.now();
    this.animating = true;
    function step(now) {
      var t = Math.min(1, (now - start) / ms);
      var e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
      pivot.rotation[axis] = target * e;
      if (t < 1) { requestAnimationFrame(step); }
      else {
        // trả object về world, reset, cập nhật trạng thái + tô màu
        moved.forEach(function (obj) { self.world.attach(obj); });
        self.world.remove(pivot);
        // reset transform sticker/body về gốc
        moved.forEach(function (obj) {
          if (obj.userData.basePos) {
            obj.position.copy(obj.userData.basePos);
            obj.quaternion.copy(obj.userData.baseQuat);
          } else {
            obj.position.set(obj.userData.cubie[0] * CS, obj.userData.cubie[1] * CS, obj.userData.cubie[2] * CS);
            obj.rotation.set(0, 0, 0);
          }
        });
        var nc = new Cube(self.state).move(move);
        self.setState(nc.state);
        self.animating = false;
        if (cb) cb();
      }
    }
    requestAnimationFrame(step);
  };

  // ================= tương tác chuột =================
  Renderer.prototype._bindInput = function () {
    var el = this.renderer.domElement;
    var self = this;
    var dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;

    function getXY(e) { var t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }

    function down(e) {
      var p = getXY(e); dragging = true; moved = false;
      lastX = downX = p.x; lastY = downY = p.y;
    }
    function move(e) {
      if (!dragging) return;
      var p = getXY(e);
      var dx = p.x - lastX, dy = p.y - lastY;
      if (Math.abs(p.x - downX) + Math.abs(p.y - downY) > 6) moved = true;
      self.world.rotation.y += dx * 0.01;
      self.world.rotation.x += dy * 0.01;
      self.world.rotation.x = Math.max(-1.4, Math.min(1.4, self.world.rotation.x));
      lastX = p.x; lastY = p.y;
      if (e.cancelable) e.preventDefault();
    }
    function up(e) {
      if (dragging && !moved && self.pickEnabled) self._handlePick(e.changedTouches ? e.changedTouches[0] : e);
      dragging = false;
    }
    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
  };

  Renderer.prototype._handlePick = function (ev) {
    var rect = this.renderer.domElement.getBoundingClientRect();
    var mouse = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    var ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    var hits = ray.intersectObjects(this.stickerMeshes, false);
    if (hits.length && this.onPick) {
      this.onPick(hits[0].object.userData.faceletIndex);
    }
  };

  Renderer.prototype._animate = function () {
    var self = this;
    function loop() {
      requestAnimationFrame(loop);
      self.renderer.render(self.scene, self.camera);
    }
    loop();
  };

  Renderer.prototype.resetView = function () {
    this.world.rotation.set(-0.2, -0.5, 0);
  };

  root.RubikRenderer = Renderer;
})(typeof self !== 'undefined' ? self : this);
