/**
 * Kiểu dữ liệu dùng chung cho lõi khối Rubik (cube + solver).
 * Không phụ thuộc DOM/Three.js — dùng được cả ở Node (test) và trình duyệt.
 */

/** Sáu mặt chuẩn, theo thứ tự facelet URFDLB dùng xuyên suốt dự án. */
export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

const FACE_PATTERN = /^[URFDLB]$/;

/** Type guard: kiểm tra một chuỗi bất kỳ có phải một trong 6 mặt hợp lệ. */
export function isFace(value: string): value is Face {
  return FACE_PATTERN.test(value);
}

export type Axis = 'x' | 'y' | 'z';

/** Một trong 18 nước đi hợp lệ: U, U', U2, R, R', R2, ... */
export type Move = `${Face}` | `${Face}'` | `${Face}2`;

const MOVE_PATTERN = /^[URFDLB](2|')?$/;

/** Type guard: kiểm tra một chuỗi bất kỳ có phải nước đi hợp lệ. */
export function isMove(value: string): value is Move {
  return MOVE_PATTERN.test(value);
}

/** Toạ độ 3D — dùng cho vị trí cubie, pháp tuyến facelet, tâm sticker. */
export type Vec3 = readonly [number, number, number];

/**
 * Trạng thái khối: đúng 54 phần tử, mỗi phần tử là MẶT-NHÀ của ô đó
 * (không phải tên màu hiển thị), thứ tự cố định URFDLB.
 */
export type FaceletState = Face[];

/** Một ô (sticker) — vị trí hình học dùng để sinh bảng hoán vị và dựng khối 3D. */
export interface Sticker {
  readonly index: number;
  readonly face: Face;
  readonly faceIdx: number;
  readonly pos: Vec3;
  readonly n: Vec3;
  readonly center: Vec3;
}

/** Định nghĩa lớp xoay hình học cho một mặt cơ bản: trục, lớp, góc xoay 1/4 vòng. */
export interface MoveDefinition {
  readonly axis: Axis;
  readonly layer: -1 | 1;
  readonly deg: -90 | 90;
}

/** Bảng hoán vị: PERMS[move][dest] = src — facelet đích lấy màu từ facelet nguồn. */
export type PermutationTable = Readonly<Record<Move, readonly number[]>>;

/** Một giai đoạn trong lời giải tầng-by-tầng, có tên để hiển thị cho người dùng. */
export interface SolveStage {
  readonly name: string;
  readonly moves: Move[];
}

/** Kết quả của một lần giải: các giai đoạn kèm tên + toàn bộ nước đi gộp lại. */
export interface SolveResult {
  readonly stages: SolveStage[];
  readonly moves: Move[];
  readonly solved: boolean;
}
