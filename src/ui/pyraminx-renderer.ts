import * as THREE from 'three';
import { InteractionManager } from './interaction';
import type { Move } from '../core/types';
import { makePermutation } from '../core/pyraminx-solver';

export type PyraminxDisplayCell = 'Y' | 'R' | 'G' | 'B' | '.';
export type PyraminxDisplayState = PyraminxDisplayCell[];

const COLORS: Readonly<Record<Exclude<PyraminxDisplayCell, '.'>, string>> = {
  Y: '#ffd500', // Yellow
  R: '#b71234', // Red
  G: '#009b48', // Green
  B: '#0046ad'  // Blue
};
const EMPTY_COLOR = '#333333';

function colorFor(cell: PyraminxDisplayCell): string {
  return cell === '.' ? EMPTY_COLOR : COLORS[cell];
}

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
  { name: 'F', A: VU, B: VL, C: VR },
  { name: 'L', A: VU, B: VB, C: VL },
  { name: 'R', A: VU, B: VR, C: VB },
  { name: 'D', A: VL, B: VB, C: VR }
];

interface StickerMeta {
  readonly index: number;
  readonly face: string;
  readonly cellIndex: number;
  readonly basePos: THREE.Vector3;
  readonly baseQuat: THREE.Quaternion;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const tips: Record<string, { pos: THREE.Vector3; axis: THREE.Vector3 }> = {
  U: { pos: VU, axis: VU.clone().normalize() },
  L: { pos: VL, axis: VL.clone().normalize() },
  R: { pos: VR, axis: VR.clone().normalize() },
  B: { pos: VB, axis: VB.clone().normalize() }
};

const rad120 = (120 * Math.PI) / 180;

export class PyraminxRenderer {
  static readonly COLORS = COLORS;

  pickEnabled = false;
  onPick: ((faceletIndex: number) => void) | null = null;

  private readonly container: HTMLElement;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private glRenderer!: THREE.WebGLRenderer;
  private world!: THREE.Group;
  private readonly stickerMeshes: THREE.Mesh[] = [];
  private readonly stickerMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly meta = new WeakMap<THREE.Object3D, StickerMeta>();
  private state: PyraminxDisplayState = new Array(36).fill('.');
  private _animating = false;

  private orientation!: THREE.Quaternion;
  private radius!: number;
  private interactionManager!: InteractionManager;

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

    // Vị trí camera hướng xéo nhìn khối kim tự tháp
    const initialPos = new THREE.Vector3(4.5, 3.5, 6.0);
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

    let resizeTimeout: number;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => this.resize(), 100);
    });
  }

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
    // 1. Tạo lõi tứ diện màu đen sẫm ở giữa để làm khe hở
    const coreGeo = new THREE.BufferGeometry();
    const s = 0.4;
    const coreVertices = new Float32Array([
      // F: VU, VL, VR
      VU.x * s, VU.y * s, VU.z * s, VL.x * s, VL.y * s, VL.z * s, VR.x * s, VR.y * s, VR.z * s,
      // L: VU, VB, VL
      VU.x * s, VU.y * s, VU.z * s, VB.x * s, VB.y * s, VB.z * s, VL.x * s, VL.y * s, VL.z * s,
      // R: VU, VR, VB
      VU.x * s, VU.y * s, VU.z * s, VR.x * s, VR.y * s, VR.z * s, VB.x * s, VB.y * s, VB.z * s,
      // D: VL, VB, VR
      VL.x * s, VL.y * s, VL.z * s, VB.x * s, VB.y * s, VB.z * s, VR.x * s, VR.y * s, VR.z * s
    ]);
    coreGeo.setAttribute('position', new THREE.BufferAttribute(coreVertices, 3));
    coreGeo.computeVertexNormals();
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x101216 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.world.add(coreMesh);

    // 2. Tạo 36 sticker tam giác
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
        throw new Error();
      };

      const addStickerMesh = (cellIdx: number, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3): void => {
        const idx = fIdx * 9 + cellIdx;
        const center = new THREE.Vector3().add(p1).add(p2).add(p3).divideScalar(3);

        // Co tam giác lại 1 chút để tạo khoảng hở (GAP)
        const shrinkFactor = 0.91;
        const sp1 = center.clone().addScaledVector(p1.clone().sub(center), shrinkFactor);
        const sp2 = center.clone().addScaledVector(p2.clone().sub(center), shrinkFactor);
        const sp3 = center.clone().addScaledVector(p3.clone().sub(center), shrinkFactor);

        // Đẩy sticker ra phía ngoài một chút xíu để tránh z-fighting với lõi
        const normal = new THREE.Vector3().crossVectors(p2.clone().sub(p1), p3.clone().sub(p1)).normalize();
        const offset = 0.006;
        sp1.addScaledVector(normal, offset);
        sp2.addScaledVector(normal, offset);
        sp3.addScaledVector(normal, offset);

        const geo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          sp1.x, sp1.y, sp1.z,
          sp2.x, sp2.y, sp2.z,
          sp3.x, sp3.y, sp3.z
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geo, mat);

        this.meta.set(mesh, {
          index: idx,
          face: f.name,
          cellIndex: cellIdx,
          basePos: center.clone(),
          baseQuat: mesh.quaternion.clone()
        });

        this.stickerMeshes[idx] = mesh;
        this.stickerMaterials[idx] = mat;
        this.world.add(mesh);
      };

      // Hàng 1
      addStickerMesh(0, getP(3, 0, 0), getP(2, 1, 0), getP(2, 0, 1));
      // Hàng 2
      addStickerMesh(1, getP(2, 1, 0), getP(1, 2, 0), getP(1, 1, 1));
      addStickerMesh(2, getP(2, 1, 0), getP(1, 1, 1), getP(2, 0, 1));
      addStickerMesh(3, getP(2, 0, 1), getP(1, 1, 1), getP(1, 0, 2));
      // Hàng 3
      addStickerMesh(4, getP(1, 2, 0), getP(0, 3, 0), getP(0, 2, 1));
      addStickerMesh(5, getP(1, 2, 0), getP(0, 2, 1), getP(1, 1, 1));
      addStickerMesh(6, getP(1, 1, 1), getP(0, 2, 1), getP(0, 1, 2));
      addStickerMesh(7, getP(1, 0, 2), getP(1, 1, 1), getP(0, 1, 2));
      addStickerMesh(8, getP(1, 0, 2), getP(0, 1, 2), getP(0, 0, 3));
    });
  }

  setState(state: PyraminxDisplayState): void {
    this.state = state.slice();
    for (let i = 0; i < 36; i++) {
      const cell = this.state[i];
      this.stickerMaterials[i].color.set(colorFor(cell));
    }
  }

  // ================= HOẠT HOẠ NƯỚC ĐI =================

  animateMove(move: Move, ms: number, cb?: () => void): void {
    if (this._animating) { cb?.(); return; }

    const isTipOnly = ['u', 'l', 'r', 'b'].includes(move[0]);
    const tipKey = move[0].toUpperCase();
    const { pos: tipPos, axis } = tips[tipKey];
    const threshold = isTipOnly ? 0.8 : 2.0;

    const pivot = new THREE.Group();
    this.world.add(pivot);

    const moved: THREE.Object3D[] = [];
    this.stickerMeshes.forEach((mesh) => {
      const m = this.meta.get(mesh);
      if (m && m.basePos.distanceTo(tipPos) < threshold) {
        moved.push(mesh);
      }
    });

    for (const obj of moved) pivot.attach(obj);

    const direction = move.endsWith("'") ? 1 : -1;
    const targetAngle = rad120 * direction;

    const start = performance.now();
    this._animating = true;

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / ms);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
      pivot.quaternion.setFromAxisAngle(axis, targetAngle * eased);

      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }

      // Trả các mesh về world, reset transform
      for (const obj of moved) this.world.attach(obj);
      this.world.remove(pivot);

      for (const obj of moved) {
        const m = this.meta.get(obj);
        if (m) {
          obj.position.set(0, 0, 0);
          obj.quaternion.copy(m.baseQuat);
        }
      }

      // Cập nhật trạng thái
      const perm = makePermutation(tipKey, targetAngle, isTipOnly);
      const nextState = new Array<PyraminxDisplayCell>(36);
      for (let i = 0; i < 36; i++) {
        nextState[i] = this.state[perm[i]];
      }
      this.setState(nextState);

      this._animating = false;
      cb?.();
    };

    requestAnimationFrame(step);
  }

  // ================= TƯƠNG TÁC CHUỘT / TOUCH =================

  private bindInput(): void {
    const el = this.glRenderer.domElement;
    this.interactionManager = new InteractionManager(el, {
      onYawPitch: (dx, dy) => {
        const currentRight = X_AXIS.clone().applyQuaternion(this.orientation);
        const currentUp = Y_AXIS.clone().applyQuaternion(this.orientation);
        const qYaw = new THREE.Quaternion().setFromAxisAngle(currentUp, -dx * 0.008);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(currentRight, -dy * 0.008);
        this.orientation.premultiply(qYaw).premultiply(qPitch);
        this.updateCameraPosition();
      },
      onZoom: (factor) => {
        this.radius = Math.max(3.0, Math.min(12.0, this.radius * factor));
        this.updateCameraPosition();
      },
      onRoll: (deltaAngle) => {
        const currentLook = Z_AXIS.clone().applyQuaternion(this.orientation);
        const qRoll = new THREE.Quaternion().setFromAxisAngle(currentLook, deltaAngle);
        this.orientation.premultiply(qRoll);
        this.updateCameraPosition();
      },
      onPick: (clientX, clientY) => {
        if (this.pickEnabled) {
          this.handlePick(clientX, clientY);
        }
      }
    });
  }

  private handlePick(clientX: number, clientY: number): void {
    const rect = this.glRenderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hits = ray.intersectObjects(this.stickerMeshes, false);
    const first = hits[0];
    if (!first || !this.onPick) return;
    const m = this.meta.get(first.object);
    if (m) this.onPick(m.index);
  }

  destroy(): void {
    this.interactionManager.destroy();
    this.container.removeChild(this.glRenderer.domElement);
  }

  private animate(): void {
    const loop = (): void => {
      requestAnimationFrame(loop);
      this.glRenderer.render(this.scene, this.camera);
    };
    loop();
  }
}
