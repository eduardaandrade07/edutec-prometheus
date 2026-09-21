export class InteractionSystem extends EventTarget {
  constructor(world, player, ui, state, audio) {
    super();
    this.world = world;
    this.player = player;
    this.ui = ui;
    this.state = state;
    this.audio = audio;
    this.focused = null;

    player.addEventListener("interact", () => this.interact());
    document.querySelector("#touch-action")?.addEventListener("click", () => this.interact());
  }

  update(camera) {
    if (!this.player.canControl()) {
      this.setFocused(null);
      return;
    }
    const direction = [
      Math.sin(camera.yaw) * Math.cos(camera.pitch),
      Math.sin(camera.pitch),
      -Math.cos(camera.yaw) * Math.cos(camera.pitch),
    ];
    let best = null;
    let bestScore = -Infinity;
    for (const target of this.world.interactables) {
      const dx = target.position[0] - camera.position[0];
      const dy = target.position[1] - camera.position[1];
      const dz = target.position[2] - camera.position[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance > target.range) continue;
      const dot = (dx * direction[0] + dy * direction[1] + dz * direction[2]) / Math.max(distance, 0.001);
      if (dot < 0.84) continue;
      const score = dot * 2 - distance * 0.09;
      if (score > bestScore) {
        best = target;
        bestScore = score;
      }
    }
    this.setFocused(best);
  }

  setFocused(target) {
    if (target?.id === this.focused?.id) return;
    this.focused = target;
    this.ui.setInteraction(target);
    if (target) this.audio.beep("focus");
  }

  interact() {
    if (!this.player.canControl()) return;
    if (!this.focused) {
      this.ui.toast("Aproxime-se de um terminal ou personagem e mire no objeto.");
      return;
    }
    this.audio.beep("confirm");
    this.dispatchEvent(new CustomEvent("interact", { detail: this.focused.id }));
  }
}

