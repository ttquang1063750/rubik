export interface InteractionCallbacks {
  readonly onYawPitch: (dx: number, dy: number) => void;
  readonly onRoll?: (deltaAngle: number) => void;
  readonly onZoom?: (factor: number) => void;
  readonly onPick?: (clientX: number, clientY: number) => void;
}

export class InteractionManager {
  private readonly element: HTMLElement;
  private readonly callbacks: InteractionCallbacks;
  
  private dragging = false;
  private moved = false;

  // Touch 1 ngón hoặc chuột
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;

  // Touch 2 ngón
  private isMultiTouch = false;
  private lastDistance = 0;
  private lastAngle = 0;
  private lastMidX = 0;
  private lastMidY = 0;

  // Danh sách các event listener để tháo gỡ khi hủy bỏ
  private readonly listeners: {
    readonly target: EventTarget;
    readonly type: string;
    readonly listener: EventListenerOrEventListenerObject;
    readonly options?: AddEventListenerOptions | boolean;
  }[] = [];

  constructor(element: HTMLElement, callbacks: InteractionCallbacks) {
    this.element = element;
    this.callbacks = callbacks;
    this.bindEvents();
  }

  private addListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): void {
    target.addEventListener(type, listener, options);
    this.listeners.push({ target, type, listener, options });
  }

  private bindEvents(): void {
    const handleDown = (e: MouseEvent | TouchEvent): void => {
      this.moved = false;

      if ('touches' in e && e.touches.length === 2) {
        this.isMultiTouch = true;
        this.dragging = true;

        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        
        this.lastDistance = Math.hypot(dx, dy);
        this.lastAngle = Math.atan2(dy, dx);
        this.lastMidX = (t1.clientX + t2.clientX) / 2;
        this.lastMidY = (t1.clientY + t2.clientY) / 2;
      } else {
        this.isMultiTouch = false;
        this.dragging = true;
        const p = this.getPointerXY(e);
        this.lastX = this.downX = p.clientX;
        this.lastY = this.downY = p.clientY;
      }
    };

    const handleMove = (e: MouseEvent | TouchEvent): void => {
      if (!this.dragging) return;

      if ('touches' in e && e.touches.length === 2) {
        if (!this.isMultiTouch) return;

        const t1 = e.touches[0];
        const t2 = e.touches[1];

        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;

        // 1. Pinch-to-zoom (Thu phóng)
        const currentDistance = Math.hypot(dx, dy);
        if (this.lastDistance > 0 && this.callbacks.onZoom) {
          const factor = this.lastDistance / currentDistance;
          this.callbacks.onZoom(factor);
        }
        this.lastDistance = currentDistance;

        // 2. Roll (Xoay nghiêng camera quanh trục nhìn)
        const currentAngle = Math.atan2(dy, dx);
        if (this.callbacks.onRoll) {
          const deltaAngle = currentAngle - this.lastAngle;
          this.callbacks.onRoll(deltaAngle);
        }
        this.lastAngle = currentAngle;

        // 3. Yaw/Pitch trung điểm
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const deltaMidX = midX - this.lastMidX;
        const deltaMidY = midY - this.lastMidY;
        
        this.callbacks.onYawPitch(deltaMidX, deltaMidY);
        
        this.lastMidX = midX;
        this.lastMidY = midY;
        this.moved = true;

        if (e.cancelable) e.preventDefault();
      } else if (!this.isMultiTouch) {
        const p = this.getPointerXY(e);
        const dx = p.clientX - this.lastX;
        const dy = p.clientY - this.lastY;

        if (Math.abs(p.clientX - this.downX) + Math.abs(p.clientY - this.downY) > 6) {
          this.moved = true;
        }

        this.callbacks.onYawPitch(dx, dy);

        this.lastX = p.clientX;
        this.lastY = p.clientY;

        if (e.cancelable) e.preventDefault();
      }
    };

    const handleUp = (e: MouseEvent | TouchEvent): void => {
      if (this.dragging && !this.moved && this.callbacks.onPick) {
        const touches = 'changedTouches' in e ? e.changedTouches : null;
        const p = touches && touches.length > 0 ? touches[0] : (e as MouseEvent);
        this.callbacks.onPick(p.clientX, p.clientY);
      }
      this.dragging = false;
      this.isMultiTouch = false;
    };

    // Chuột: Down trên element, Move/Up trên window để không bị mất kéo
    this.addListener(this.element, 'mousedown', handleDown as EventListener);
    this.addListener(window, 'mousemove', handleMove as EventListener);
    this.addListener(window, 'mouseup', handleUp as EventListener);

    // Touch: Lắng nghe trên element và window
    this.addListener(this.element, 'touchstart', handleDown as EventListener, { passive: false });
    this.addListener(window, 'touchmove', handleMove as EventListener, { passive: false });
    this.addListener(window, 'touchend', handleUp as EventListener);
  }

  private getPointerXY(e: MouseEvent | TouchEvent): { readonly clientX: number; readonly clientY: number } {
    if ('touches' in e) {
      const t = e.touches[0];
      if (!t) throw new Error('TouchEvent không có touch nào');
      return t;
    }
    return e;
  }

  /**
   * Tháo gỡ các event listeners để tránh rò rỉ bộ nhớ.
   */
  destroy(): void {
    for (const item of this.listeners) {
      item.target.removeEventListener(item.type, item.listener, item.options);
    }
    this.listeners.length = 0;
  }
}
