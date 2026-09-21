import { clamp } from "./math.js?v=3.0.1";

const IS_TOUCH = window.matchMedia("(pointer: coarse)").matches;

export class PlayerController extends EventTarget {
  constructor(canvas, state) {
    super();
    this.canvas = canvas;
    this.state = state;
    this.position = [0, 1.68, -1.35];
    this.yaw = -0.58;
    this.pitch = -0.03;
    this.keys = new Set();
    this.walkTime = 0;
    this.moved = false;
    this.pointerLocked = false;
    this.intentionalUnlock = false;
    this.joystick = { x: 0, y: 0, pointerId: null };
    this.lookTouch = null;
    this.bindControls();
  }

  bindControls() {
    window.addEventListener("keydown", (event) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
        this.keys.add(event.code);
        event.preventDefault();
      }
      if (event.code === "KeyE" && this.canControl()) {
        event.preventDefault();
        this.dispatchEvent(new Event("interact"));
      }
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      const intentional = !this.pointerLocked && this.intentionalUnlock;
      this.intentionalUnlock = false;
      this.dispatchEvent(new CustomEvent("pointerlock", { detail: { locked: this.pointerLocked, intentional } }));
    });
    document.addEventListener("mousemove", (event) => {
      if (!this.pointerLocked || !this.canControl()) return;
      this.rotate(event.movementX, event.movementY);
    });
    this.canvas.addEventListener("mousedown", (event) => {
      if (!this.canControl() || IS_TOUCH) return;
      if (!this.pointerLocked) {
        this.canvas.requestPointerLock?.();
      } else if (event.button === 0) {
        this.dispatchEvent(new Event("interact"));
      }
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    this.canvas.addEventListener("touchstart", (event) => {
      if (!this.canControl()) return;
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.clientX > window.innerWidth * 0.38 && !this.lookTouch) {
          this.lookTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
        }
      }
    }, { passive: true });
    this.canvas.addEventListener("touchmove", (event) => {
      if (!this.canControl() || !this.lookTouch) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === this.lookTouch.id);
      if (!touch) return;
      this.rotate((touch.clientX - this.lookTouch.x) * 1.2, (touch.clientY - this.lookTouch.y) * 1.2);
      this.lookTouch.x = touch.clientX;
      this.lookTouch.y = touch.clientY;
      event.preventDefault();
    }, { passive: false });
    const endLook = (event) => {
      if (Array.from(event.changedTouches).some((item) => item.identifier === this.lookTouch?.id)) this.lookTouch = null;
    };
    this.canvas.addEventListener("touchend", endLook, { passive: true });
    this.canvas.addEventListener("touchcancel", endLook, { passive: true });

    this.bindJoystick();
  }

  bindJoystick() {
    const stick = document.querySelector("#touch-stick");
    const knob = stick?.querySelector("span");
    if (!stick || !knob) return;

    const update = (event) => {
      const rect = stick.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const radius = rect.width * 0.34;
      const scale = distance > radius ? radius / distance : 1;
      const x = dx * scale;
      const y = dy * scale;
      this.joystick.x = x / radius;
      this.joystick.y = y / radius;
      knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };
    const release = (event) => {
      if (event.pointerId !== this.joystick.pointerId) return;
      this.joystick = { x: 0, y: 0, pointerId: null };
      knob.style.transform = "translate(-50%, -50%)";
    };

    stick.addEventListener("pointerdown", (event) => {
      this.joystick.pointerId = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      update(event);
    });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.joystick.pointerId) update(event);
    });
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);
  }

  canControl() {
    return this.state.playing && !this.state.paused && !this.state.modalOpen;
  }

  rotate(deltaX, deltaY) {
    const sensitivity = IS_TOUCH ? 0.003 : 0.00215;
    this.yaw -= deltaX * sensitivity;
    this.pitch = clamp(this.pitch - deltaY * sensitivity, -1.05, 1.05);
  }

  reset() {
    this.position = [0, 1.68, -1.35];
    this.yaw = -0.58;
    this.pitch = -0.03;
    this.keys.clear();
    this.walkTime = 0;
    this.moved = false;
  }

  place(position = [0, 1.68, -1.35], yaw = -0.58, pitch = -0.03) {
    this.position = [...position];
    this.yaw = yaw;
    this.pitch = pitch;
    this.keys.clear();
    this.joystick.x = 0;
    this.joystick.y = 0;
  }

  releasePointer() {
    const ownsPointer = document.pointerLockElement === this.canvas;
    this.intentionalUnlock = ownsPointer;
    if (ownsPointer) document.exitPointerLock?.();
  }

  requestPointer() {
    if (IS_TOUCH || !this.canControl()) return;
    try {
      const request = this.canvas.requestPointerLock?.();
      request?.catch?.(() => {});
    } catch {
      // Um clique posterior no canvas solicita o controle novamente.
    }
  }

  update(deltaSeconds) {
    if (!this.canControl()) return;
    const forwardInput = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.joystick.y;
    const sideInput = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0) + this.joystick.x;
    const inputLength = Math.hypot(forwardInput, sideInput);
    if (inputLength < 0.05) return;

    const forward = forwardInput / Math.max(1, inputLength);
    const side = sideInput / Math.max(1, inputLength);
    const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = sprinting ? 5.15 : 3.45;
    const distance = speed * Math.min(deltaSeconds, 0.045);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const nextX = this.position[0] + (sin * forward + cos * side) * distance;
    const nextZ = this.position[2] + (-cos * forward + sin * side) * distance;
    const resolved = this.resolveCollision(nextX, nextZ);
    this.position[0] = resolved[0];
    this.position[2] = resolved[1];
    this.walkTime += distance;

    if (!this.moved) {
      this.moved = true;
      this.dispatchEvent(new Event("firstmove"));
    }
  }

  resolveCollision(nextX, nextZ) {
    const radius = 0.34;
    let x = clamp(nextX, -9.25 + radius, 9.25 - radius);
    let z = clamp(nextZ, -10.25 + radius, 10.25 - radius);
    const dividerMin = 0.53;
    const dividerMax = 1.27;
    const inDoorway = x > 2.2 && x < 4.85;
    if (!inDoorway && z > dividerMin && z < dividerMax) {
      const wasLabSide = this.position[2] <= dividerMin;
      z = wasLabSide ? dividerMin : dividerMax;
    }
    return [x, z];
  }

  getCamera(reducedEffects = false) {
    const moving = this.keys.has("KeyW") || this.keys.has("KeyA") || this.keys.has("KeyS") || this.keys.has("KeyD") || Math.hypot(this.joystick.x, this.joystick.y) > 0.05;
    const bob = moving && !reducedEffects ? Math.sin(this.walkTime * 3.2) * 0.025 : 0;
    return {
      position: [this.position[0], 1.68 + bob, this.position[2]],
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }
}

export const isTouchDevice = IS_TOUCH;
