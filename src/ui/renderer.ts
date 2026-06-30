/**
 * Dựng & hoạt hoạ khối Rubik 3D bằng Three.js.
 *
 * - build(): tạo 26 cubie + 54 sticker (mỗi sticker gắn faceletIndex qua WeakMap,
 *   không dùng Object3D.userData vì Three.js khai báo nó kiểu `any`).
 * - setState(state): tô lại màu từ trạng thái (chấp nhận cả ô '.' chưa tô, hiển
 *   thị xám — dùng trong chế độ nhập màu).
 * - animateMove(move, ms, cb): xoay 1 lớp 90° rồi cập nhật.
 * - kéo chuột để xoay toàn khối; chạm sticker -> onPick(faceletIndex) (chế độ nhập).
 */
import * as THREE from 'three';
import { Cube } from '../core/cube';
import { isFace } from '../core/types';
import type { Face, FaceletState, Move, Vec3 } from '../core/types';

/** Giá trị 1 ô để hiển thị: 1 trong 6 mặt, hoặc '.' nếu chưa tô (chế độ nhập). */
export type DisplayCell = Face | '.';
export type DisplayState = DisplayCell[];

const COLORS: Readonly<Record<Face, string>> = {
  U: '#ffffff', D: '#ffd500', F: '#009b48',
  B: '#0046ad', R: '#b71234', L: '#ff5800'
};
const EMPTY_COLOR = '#333333';
const CUBIE_SIZE = 1.0;
const GAP = 0.06;

function colorFor(cell: DisplayCell): string {
  return cell === '.' ? EMPTY_COLOR : COLORS[cell];
}

/** Trạng thái hiển thị đã tô đủ màu (không còn ô '.') — báo lỗi rõ nếu chưa đủ. */
export function assertFaceletState(state: DisplayState): FaceletState {
  const result: Face[] = [];
  for (const cell of state) {
    if (cell === '.') throw new Error('Không thể xoay khi còn ô chưa tô màu');
    result.push(cell);
  }
  return result;
}

function faceOf(move: Move): Face {
  const f = move[0];
  if (!isFace(f)) throw new Error(`Nước không hợp lệ: ${move}`);
  return f;
}

const AXIS: Readonly<Record<Face, 'x' | 'y' | 'z'>> = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };
const LAYER: Readonly<Record<Face, -1 | 1>> = { U: 1, D: -1, R: 1, L: -1, F: 1, B: -1 };
const AXIS_INDEX: Readonly<Record<'x' | 'y' | 'z', 0 | 1 | 2>> = { x: 0, y: 1, z: 2 };

/** Chiều quay hình học cho 1 nước — đồng bộ với MOVE_DEF của engine. */
function moveAngle(move: Move): number {
  const face = faceOf(move);
  const base = Cube.MOVE_DEF[face].deg; // -90 hoặc 90
  const times = move.length === 1 ? 1 : move[1] === "'" ? -1 : 2;
  return ((base * Math.PI) / 180) * times;
}

interface BodyMeta {
  readonly kind: 'body';
  readonly cubie: Vec3;
}
interface StickerMeta {
  readonly kind: 'sticker';
  readonly cubie: Vec3;
  readonly faceletIndex: number;
  readonly basePos: THREE.Vector3;
  readonly baseQuat: THREE.Quaternion;
}
type ObjectMeta = BodyMeta | StickerMeta;

interface PointerLike {
  readonly clientX: number;
  readonly clientY: number;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function pointerXY(e: MouseEvent | TouchEvent): PointerLike {
  if ('touches' in e) {
    const t = e.touches[0];
    if (!t) throw new Error('TouchEvent không có touch nào');
    return t;
  }
  return e;
}

export class RubikRenderer {
  static readonly COLORS: Readonly<Record<Face, string>> = COLORS;

  pickEnabled = false;
  onPick: ((faceletIndex: number) => void) | null = null;

  private readonly container: HTMLElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private glRenderer!: THREE.WebGLRenderer;
  private world!: THREE.Group;
  private readonly stickerMeshes: THREE.Mesh[] = [];
  private readonly stickerMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly meta = new WeakMap<THREE.Object3D, ObjectMeta>();
  private state: DisplayState = Cube.solved().state;
  private _animating = false;
  // Camera xoay tự do quanh khối bằng quaternion gia tăng theo trục HIỆN TẠI của
  // camera (lấy lại mỗi lần kéo, không phải trục cố định) — không dùng góc tuyệt
  // đối kiểu toạ độ cầu vì cách đó có "cực" (pitch ±90°) gây kẹt xoay ngang khi
  // pitch tới gần cực. Quaternion gia tăng không có khái niệm cực nên xoay được
  // vô hạn vòng theo mọi hướng, giống cầm khối thật xoay tự do trong tay.
  private orientation!: THREE.Quaternion;
  private radius!: number;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
    this.build();
    this.bindInput();
    this.animate();
  }

  get animating(): boolean {
    return this._animating;
  }

  private init(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);

    // Đặt camera ở vị trí gốc rồi lưu lại quaternion đó làm orientation ban đầu —
    // từ đây camera.position luôn = (0,0,radius) xoay theo orientation, không
    // cần gọi lookAt() nữa nên không bị giới hạn bởi up-vector hint.
    const initialPos = new THREE.Vector3(5.2, 5.0, 6.4);
    this.radius = initialPos.length();
    this.camera.position.copy(initialPos);
    this.camera.lookAt(0, 0, 0);
    this.orientation = this.camera.quaternion.clone();

    this.glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.glRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.glRenderer.setSize(w, h);
    this.container.appendChild(this.glRenderer.domElement);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    window.addEventListener('resize', () => this.resize());
  }

  /** Cập nhật vị trí + hướng camera từ orientation hiện tại (không gọi lookAt). */
  private updateCameraPosition(): void {
    this.camera.position.set(0, 0, this.radius).applyQuaternion(this.orientation);
    this.camera.quaternion.copy(this.orientation);
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.glRenderer.setSize(w, h);
  }

  private build(): void {
    // thân cubie (đen)
    const bodyGeo = new THREE.BoxGeometry(CUBIE_SIZE - GAP, CUBIE_SIZE - GAP, CUBIE_SIZE - GAP);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x101216 });
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.set(x * CUBIE_SIZE, y * CUBIE_SIZE, z * CUBIE_SIZE);
          this.meta.set(body, { kind: 'body', cubie: [x, y, z] });
          this.world.add(body);
        }
      }
    }

    // sticker từ STICKERS
    const stickerGeo = new THREE.PlaneGeometry(CUBIE_SIZE - GAP - 0.06, CUBIE_SIZE - GAP - 0.06);
    for (const s of Cube.STICKERS) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(stickerGeo, mat);
      const [px, py, pz] = s.pos;
      const [nx, ny, nz] = s.n;
      mesh.position.set(
        px * CUBIE_SIZE + nx * (CUBIE_SIZE / 2 + 0.001),
        py * CUBIE_SIZE + ny * (CUBIE_SIZE / 2 + 0.001),
        pz * CUBIE_SIZE + nz * (CUBIE_SIZE / 2 + 0.001)
      );
      // hướng mặt theo pháp tuyến
      mesh.lookAt(mesh.position.clone().add(new THREE.Vector3(nx, ny, nz)));
      this.meta.set(mesh, {
        kind: 'sticker',
        cubie: s.pos,
        faceletIndex: s.index,
        basePos: mesh.position.clone(),
        baseQuat: mesh.quaternion.clone()
      });
      this.stickerMeshes[s.index] = mesh;
      this.stickerMaterials[s.index] = mat;
      this.world.add(mesh);
    }
  }

  setState(state: DisplayState): void {
    this.state = state.slice();
    for (let i = 0; i < 54; i++) {
      const cell = this.state[i];
      this.stickerMaterials[i].color.set(colorFor(cell));
    }
  }

  // ================= hoạt hoạ nước đi =================

  animateMove(move: Move, ms: number, cb?: () => void): void {
    if (this._animating) { cb?.(); return; }
    const face = faceOf(move);
    const axis = AXIS[face];
    const layer = LAYER[face];
    const ai = AXIS_INDEX[axis];

    const pivot = new THREE.Group();
    this.world.add(pivot);
    const moved: THREE.Object3D[] = [];
    for (const obj of this.world.children) {
      if (obj === pivot) continue;
      const m = this.meta.get(obj);
      if (m && m.cubie[ai] === layer) moved.push(obj);
    }
    for (const obj of moved) pivot.attach(obj);

    const target = moveAngle(move);
    const start = performance.now();
    this._animating = true;

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / ms);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
      pivot.rotation[axis] = target * eased;
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      // trả object về world, reset transform, cập nhật trạng thái + tô màu
      for (const obj of moved) this.world.attach(obj);
      this.world.remove(pivot);
      for (const obj of moved) {
        const m = this.meta.get(obj);
        if (!m) continue;
        if (m.kind === 'sticker') {
          obj.position.copy(m.basePos);
          obj.quaternion.copy(m.baseQuat);
        } else {
          obj.position.set(m.cubie[0] * CUBIE_SIZE, m.cubie[1] * CUBIE_SIZE, m.cubie[2] * CUBIE_SIZE);
          obj.rotation.set(0, 0, 0);
        }
      }
      const next = new Cube(assertFaceletState(this.state)).move(move);
      this.setState(next.state);
      this._animating = false;
      cb?.();
    };
    requestAnimationFrame(step);
  }

  // ================= tương tác chuột =================

  private bindInput(): void {
    const el = this.glRenderer.domElement;
    let dragging = false;
    let moved = false;
    let lastX = 0, lastY = 0, downX = 0, downY = 0;

    const down = (e: MouseEvent | TouchEvent): void => {
      const p = pointerXY(e);
      dragging = true;
      moved = false;
      lastX = downX = p.clientX;
      lastY = downY = p.clientY;
    };

    const move = (e: MouseEvent | TouchEvent): void => {
      if (!dragging) return;
      const p = pointerXY(e);
      const dx = p.clientX - lastX;
      const dy = p.clientY - lastY;
      if (Math.abs(p.clientX - downX) + Math.abs(p.clientY - downY) > 6) moved = true;
      // Trục "phải"/"lên" HIỆN TẠI của camera (lấy lại mỗi lần kéo) — xoay quanh
      // 2 trục này luôn cho cảm giác đúng theo màn hình bất kể đã xoay bao nhiêu.
      const currentRight = X_AXIS.clone().applyQuaternion(this.orientation);
      const currentUp = Y_AXIS.clone().applyQuaternion(this.orientation);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(currentUp, -dx * 0.01);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(currentRight, -dy * 0.01);
      this.orientation.premultiply(qYaw).premultiply(qPitch);
      this.updateCameraPosition();
      lastX = p.clientX;
      lastY = p.clientY;
      if (e.cancelable) e.preventDefault();
    };

    const up = (e: MouseEvent | TouchEvent): void => {
      if (dragging && !moved && this.pickEnabled) {
        const pointer: PointerLike = 'changedTouches' in e ? e.changedTouches[0] : e;
        this.handlePick(pointer);
      }
      dragging = false;
    };

    el.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
  }

  private handlePick(ev: PointerLike): void {
    const rect = this.glRenderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hits = ray.intersectObjects(this.stickerMeshes, false);
    const first = hits[0];
    if (!first || !this.onPick) return;
    const m = this.meta.get(first.object);
    if (m && m.kind === 'sticker') this.onPick(m.faceletIndex);
  }

  private animate(): void {
    const loop = (): void => {
      requestAnimationFrame(loop);
      this.glRenderer.render(this.scene, this.camera);
    };
    loop();
  }
}
