import { AudioSystem } from "./audio.js?v=3.0.1";
import { InteractionSystem } from "./interaction.js?v=3.0.1";
import { MissionManager } from "./missions.js?v=3.0.1";
import { PlayerController, isTouchDevice } from "./player.js?v=3.0.1";
import { gameState } from "./state.js?v=3.0.1";
import { GameUI } from "./ui.js?v=3.0.1";
import { WorldRenderer } from "./world.js?v=3.0.1";

const canvas = document.querySelector("#game-canvas");
const audio = new AudioSystem(() => gameState.settings.volume);
const ui = new GameUI(gameState, audio);

let world;
let player;
let interaction;
let mission;
let lastFrame = performance.now();
let lastRender = 0;

function pause() {
  if (!gameState.playing || gameState.paused || gameState.modalOpen) return;
  gameState.paused = true;
  gameState.saveProgress();
  player.releasePointer();
  ui.showPause();
}

function resume() {
  if (!gameState.started) return;
  gameState.playing = true;
  gameState.paused = false;
  ui.hidePause();
}

function enterCampaign(resuming = false) {
  gameState.started = true;
  gameState.playing = true;
  gameState.paused = false;
  gameState.startedAt = performance.now();
  ui.enterGame(isTouchDevice);
  if (resuming) mission.resume();
  else mission.start();
  player.requestPointer();
}

function bindGameEvents() {
  ui.addEventListener("start", () => {
    gameState.beginNewCampaign();
    player.reset();
    world.syncCampaign(gameState);
    audio.ensureContext();
    audio.startAmbient();
    ui.showAlert();
  });
  ui.addEventListener("continue", () => {
    gameState.resumeCampaign();
    audio.ensureContext();
    audio.startAmbient();
    enterCampaign(true);
  });
  ui.addEventListener("enterlab", () => enterCampaign(false));
  ui.addEventListener("pause", pause);
  ui.addEventListener("resume", resume);
  ui.addEventListener("menu", () => {
    gameState.saveProgress();
    gameState.playing = false;
    gameState.paused = false;
    player.releasePointer();
    ui.showBoot();
  });
  ui.addEventListener("newcampaign", () => {
    if (ui.els.reportDialog.open) ui.els.reportDialog.close();
    gameState.beginNewCampaign();
    player.reset();
    world.syncCampaign(gameState);
    ui.hideGame();
    audio.ensureContext();
    audio.startAmbient();
    ui.showAlert();
  });
  ui.addEventListener("modalchange", (event) => {
    if (event.detail) player.releasePointer();
    else if (gameState.playing && !gameState.paused) player.requestPointer();
  });
  player.addEventListener("firstmove", () => ui.dismissControlHint(), { once: true });
  player.addEventListener("pointerlock", (event) => {
    const { locked, intentional } = event.detail;
    if (!locked && !intentional && gameState.playing && !gameState.modalOpen && !gameState.paused && !isTouchDevice) pause();
  });
  interaction.addEventListener("interact", (event) => mission.interact(event.detail));
  gameState.addEventListener("settings", (event) => {
    world.applySettings(event.detail);
    audio.updateVolume();
  });
  gameState.addEventListener("metrics", (event) => ui.updateMetrics(event.detail));
  world.addEventListener("contextlost", () => {
    gameState.playing = false;
    ui.toast("A sessão gráfica foi interrompida. Recarregue a página para continuar.", "amber", 8000);
  });
  window.addEventListener("blur", () => {
    if (gameState.playing && !gameState.modalOpen) pause();
  });
  window.addEventListener("beforeunload", () => {
    if (gameState.started && !gameState.completed) gameState.saveProgress();
  });
}

function frame(now) {
  const delta = (now - lastFrame) / 1000;
  lastFrame = now;
  player.update(delta);
  const camera = player.getCamera(gameState.settings.reducedEffects);
  interaction.update(camera);
  const renderInterval = gameState.settings.quality === "low" ? 1000 / 30 : 0;
  if (now - lastRender >= renderInterval) {
    world.render(camera, now);
    lastRender = now;
  }
  requestAnimationFrame(frame);
}

try {
  world = new WorldRenderer(canvas, gameState.settings);
  player = new PlayerController(canvas, gameState);
  interaction = new InteractionSystem(world, player, ui, gameState, audio);
  mission = new MissionManager(gameState, ui, world, player);
  world.syncCampaign(gameState);
  bindGameEvents();
  ui.ready();
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  ui.fail("Não foi possível iniciar o ambiente 3D neste navegador.");
}
