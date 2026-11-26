import type { InputSnapshot, PlayerEmoteKind } from '../core/types';
import type { SpellId } from '../rpg/rpgTypes';

/**
 * Modular input handler modeled after UE5 Enhanced Input action mapping.
 * Tracks edge-triggered actions (Jump, Attack, Spells 1-4, Vent G, Heal Q, Mana Draught 5)
 * and continuous intents (Movement, Sprint, Crouch, RMB Guard).
 */
export class InputManager {
  private readonly element: HTMLElement;
  private readonly keys = new Set<string>();
  private crouchToggled = false;
  private jumpQueued = false;
  private interactQueued = false;
  private attackQueued = false;
  private heavyAttackQueued = false;
  private firearmQueued = false;
  private dodgeQueued = false;
  private spellQueued: SpellId | null = null;
  private ventQueued = false;
  private healQueued = false;
  private manaPotionQueued = false;
  private emoteQueued: PlayerEmoteKind | null = null;
  private rightMouseHeld = false;
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private isDraggingLook = false;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private _pointerLocked = false;
  private inputEnabled = true;
  private readonly onPointerLockChange?: (locked: boolean) => void;
  private readonly isDialogueOpen?: () => boolean;

  constructor(
    element: HTMLElement,
    onPointerLockChange?: (locked: boolean) => void,
    isDialogueOpen?: () => boolean
  ) {
    this.element = element;
    this.onPointerLockChange = onPointerLockChange;
    this.isDialogueOpen = isDialogueOpen;
    this.bind();
  }

  public get pointerLocked(): boolean {
    return this._pointerLocked;
  }

  public setEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.clearAll();
    }
  }

  public requestPointerLock(): void {
    if (!this.inputEnabled) return;
    try {
      if (document.pointerLockElement !== this.element && this.element.requestPointerLock) {
        const res = this.element.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            // Pointer lock may be unavailable in restricted iframes; drag-look fallback stays active.
          });
        }
      }
    } catch {
      // Fallback drag-look remains active.
    }
  }

  public sample(): InputSnapshot {
    if (!this.inputEnabled) {
      this.clearAll();
      return {
        moveForward: 0,
        moveRight: 0,
        sprintHeld: false,
        crouchActive: false,
        jumpPressed: false,
        jumpHeld: false,
        interactPressed: false,
        attackPressed: false,
        heavyAttackPressed: false,
        firearmPressed: false,
        dodgePressed: false,
        spellPressed: null,
        ventPressed: false,
        healPressed: false,
        manaPotionPressed: false,
        emotePressed: null,
        guardHeld: false,
        lookDeltaX: 0,
        lookDeltaY: 0,
      };
    }

    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
      - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const right = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

    const ctrlHeld = this.keys.has('ControlLeft') || this.keys.has('ControlRight');

    const snapshot: InputSnapshot = {
      moveForward: forward,
      moveRight: right,
      sprintHeld: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      crouchActive: ctrlHeld || this.crouchToggled,
      jumpPressed: this.jumpQueued,
      jumpHeld: this.keys.has('Space'),
      interactPressed: this.interactQueued,
      attackPressed: this.attackQueued,
      heavyAttackPressed: this.heavyAttackQueued,
      firearmPressed: this.firearmQueued,
      dodgePressed: this.dodgeQueued,
      spellPressed: this.spellQueued,
      ventPressed: this.ventQueued,
      healPressed: this.healQueued,
      manaPotionPressed: this.manaPotionQueued,
      emotePressed: this.emoteQueued,
      guardHeld: this.rightMouseHeld,
      lookDeltaX: this.lookDeltaX,
      lookDeltaY: this.lookDeltaY,
    };

    // Consume single-frame edge actions
    this.jumpQueued = false;
    this.interactQueued = false;
    this.attackQueued = false;
    this.heavyAttackQueued = false;
    this.firearmQueued = false;
    this.dodgeQueued = false;
    this.spellQueued = null;
    this.ventQueued = false;
    this.healQueued = false;
    this.manaPotionQueued = false;
    this.emoteQueued = null;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;

    return snapshot;
  }

  public clearAll(): void {
    this.keys.clear();
    this.jumpQueued = false;
    this.interactQueued = false;
    this.attackQueued = false;
    this.heavyAttackQueued = false;
    this.firearmQueued = false;
    this.dodgeQueued = false;
    this.spellQueued = null;
    this.ventQueued = false;
    this.healQueued = false;
    this.manaPotionQueued = false;
    this.emoteQueued = null;
    this.rightMouseHeld = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.isDraggingLook = false;
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.inputEnabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) {
        this.jumpQueued = true;
      }
    }

    if (e.code === 'KeyE' && !e.repeat) {
      this.interactQueued = true;
    }

    if (e.code === 'KeyF' && !e.repeat) {
      this.attackQueued = true;
    }

    if (e.code === 'KeyR' && !e.repeat) {
      this.heavyAttackQueued = true;
    }

    if (e.code === 'KeyX' && !e.repeat) {
      this.firearmQueued = true;
    }

    if (e.code === 'KeyG' && !e.repeat) {
      this.ventQueued = true;
    }

    if (e.code === 'KeyQ' && !e.repeat) {
      this.healQueued = true;
    }

    if ((e.code === 'KeyV' || e.code === 'AltLeft') && !e.repeat) {
      if (e.code === 'AltLeft') e.preventDefault();
      this.dodgeQueued = true;
    }

    if (!e.repeat && !(this.isDialogueOpen && this.isDialogueOpen())) {
      if (e.code === 'Digit1') this.spellQueued = 'arc_bolt';
      else if (e.code === 'Digit2') this.spellQueued = 'pyre_nova';
      else if (e.code === 'Digit3') this.spellQueued = 'chrono_ward';
      else if (e.code === 'Digit4') this.spellQueued = 'ley_lance';
      else if (e.code === 'Digit5') this.manaPotionQueued = true;
      else if (e.code === 'F1') {
        e.preventDefault();
        this.emoteQueued = 'wave';
      } else if (e.code === 'F2') {
        e.preventDefault();
        this.emoteQueued = 'salute';
      } else if (e.code === 'F3') {
        e.preventDefault();
        this.emoteQueued = 'sit';
      }
    }

    if (e.code === 'KeyC' && !e.repeat) {
      this.crouchToggled = !this.crouchToggled;
    }

    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      this.crouchToggled = false;
    }

    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      this.crouchToggled = false;
    }

    this.keys.add(e.code);
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly handlePointerDown = (e: PointerEvent): void => {
    if (!this.inputEnabled) return;
    if (e.button === 0) {
      if (document.pointerLockElement === this.element) {
        this.attackQueued = true;
      } else {
        this.isDraggingLook = true;
        this.pointerDownX = e.clientX;
        this.pointerDownY = e.clientY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    } else if (e.button === 2) {
      this.rightMouseHeld = true;
      if (document.pointerLockElement !== this.element) {
        this.isDraggingLook = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    }
  };

  private readonly handlePointerUp = (e: PointerEvent): void => {
    if (e.button === 0) {
      if (
        this.inputEnabled &&
        this.isDraggingLook &&
        document.pointerLockElement !== this.element &&
        Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY) < 5
      ) {
        this.attackQueued = true;
      }
      this.isDraggingLook = false;
    } else if (e.button === 2) {
      this.rightMouseHeld = false;
      this.isDraggingLook = false;
    }
  };

  private readonly handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private readonly handleMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.element) {
      this.lookDeltaX += e.movementX;
      this.lookDeltaY += e.movementY;
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.lookDeltaX += dx;
      this.lookDeltaY += dy;
    }
  };

  private readonly handlePointerLockChange = (): void => {
    this._pointerLocked = document.pointerLockElement === this.element;
    this.onPointerLockChange?.(this._pointerLocked);
  };

  private readonly handleBlur = (): void => {
    this.clearAll();
  };

  private bind(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.element.addEventListener('pointerdown', this.handlePointerDown);
    this.element.addEventListener('contextmenu', this.handleContextMenu);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('mousemove', this.handleMouseMove);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
  }
}
