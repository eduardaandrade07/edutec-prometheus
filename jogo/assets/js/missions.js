import { CHAPTERS, DIALOGUES, MISSION_STEPS } from "./data.js?v=3.0.1";

const ACTIVITY_LOADERS = {
  "sample-intake": () => import("./chapters/sample.js?v=3.0.1"),
  pcr: () => import("./chapters/pcr.js?v=3.0.1"),
  sequencing: () => import("./chapters/sequencing.js?v=3.0.1"),
  outbreak: () => import("./chapters/outbreak.js?v=3.0.1"),
  response: () => import("./chapters/response.js?v=3.0.1"),
  vaccine: () => import("./chapters/vaccine.js?v=3.0.1"),
  mutation: () => import("./chapters/mutation.js?v=3.0.1"),
  finale: () => import("./chapters/finale.js?v=3.0.1"),
};

const activityCache = new Map();

function loadActivity(id) {
  if (!activityCache.has(id)) {
    const loading = ACTIVITY_LOADERS[id]().catch((error) => {
      activityCache.delete(id);
      throw error;
    });
    activityCache.set(id, loading);
  }
  return activityCache.get(id);
}

const CHAPTER_SPAWNS = {
  1: [[0, 1.68, -1.35], -0.58],
  2: [[-4.3, 1.68, 6.7], -2.30],
  3: [[-4.5, 1.68, -1.5], -1.26],
  4: [[4.8, 1.68, -5.7], 0.91],
  5: [[0.6, 1.68, 4.1], -2.29],
  6: [[5.0, 1.68, -0.9], 1.37],
  7: [[3.4, 1.68, -2.5], -1.2],
  8: [[2.9, 1.68, 2.5], -2.19],
};

export class MissionManager {
  constructor(state, ui, world, player) {
    this.state = state;
    this.ui = ui;
    this.world = world;
    this.player = player;
    this.busy = false;
  }

  start() {
    this.state.setStep(0);
    this.prepareCurrentStep();
    this.ui.setSample(false);
    this.ui.updateMetrics(this.state.metrics());
  }

  resume() {
    this.normalizeSavedStep();
    this.prepareCurrentStep();
    this.ui.setSample(this.state.hasSample);
    this.ui.updateMetrics(this.state.metrics());
    this.world.syncCampaign(this.state);
    const spawn = CHAPTER_SPAWNS[this.state.currentChapter] || CHAPTER_SPAWNS[1];
    this.player.place(...spawn);
    this.ui.toast(`Investigação retomada no Capítulo ${this.state.currentChapter}.`);
  }

  normalizeSavedStep() {
    const completionFlags = {
      0: "helenaMet",
      1: "casesCompared",
      2: "caioConsulted",
      3: "hasSample",
      4: "sampleValidated",
      5: "pcrComplete",
      6: "sequenceComplete",
      7: "outbreakMapped",
      8: "responseComplete",
      9: "vaccineComplete",
      10: "mutationComplete",
    };
    while (completionFlags[this.state.currentStep] && this.state[completionFlags[this.state.currentStep]]) {
      this.state.setStep(this.state.currentStep + 1);
    }
  }

  prepareCurrentStep() {
    const step = MISSION_STEPS[this.state.currentStep];
    if (!step) return;
    this.world.setActiveTarget(step.target);
    this.world.setChapter(step.chapter);
    this.world.syncCampaign(this.state);
    this.ui.setObjective(this.state.currentStep);
    this.ui.updateMetrics(this.state.metrics());
    this.preloadUpcomingActivity();
  }

  preloadUpcomingActivity() {
    const upcoming = MISSION_STEPS.slice(this.state.currentStep).find((item) => ACTIVITY_LOADERS[item.id]);
    if (upcoming) loadActivity(upcoming.id).catch(() => {});
  }

  async advance() {
    const previous = MISSION_STEPS[this.state.currentStep];
    const nextIndex = this.state.currentStep + 1;
    if (nextIndex >= MISSION_STEPS.length) return;
    this.state.setStep(nextIndex);
    const next = MISSION_STEPS[nextIndex];
    this.prepareCurrentStep();
    if (next.chapter !== previous.chapter) {
      const spawn = CHAPTER_SPAWNS[next.chapter] || CHAPTER_SPAWNS[1];
      this.player.place(...spawn);
      await this.ui.showChapter(CHAPTERS[next.chapter - 1]);
    }
  }

  async interact(id) {
    if (this.busy) return;
    const step = MISSION_STEPS[this.state.currentStep];
    if (!step || id !== step.target) {
      this.handleOutOfSequence(id);
      return;
    }

    this.busy = true;
    try {
      if (step.id === "helena") await this.meetHelena();
      else if (step.id === "cases") await this.compareCases();
      else if (step.id === "caio") await this.callCaio();
      else if (step.id === "sample") await this.collectSample();
      else if (ACTIVITY_LOADERS[step.id]) await this.runActivity(step.id);
    } catch (error) {
      console.error(error);
      if (this.ui.els.panelDialog.open) this.ui.els.panelDialog.close();
      this.ui.toast("O módulo encontrou um problema. Tente abrir a estação novamente.", "amber", 6000);
      this.prepareCurrentStep();
    } finally {
      this.busy = false;
    }
  }

  handleOutOfSequence(id) {
    const step = MISSION_STEPS[this.state.currentStep];
    const known = this.world.interactables.some((target) => target.id === id);
    const message = known
      ? `Essa estação não responde à pergunta atual. Objetivo: ${step?.objective || "continue a investigação"}`
      : "Esse objeto não é necessário nesta etapa.";
    this.ui.toast(message, "amber");
  }

  async meetHelena() {
    this.state.log("briefing_helena");
    await this.ui.playDialogue(DIALOGUES.helena);
    this.state.setFlag("helenaMet");
    this.unlock(["investigation", "infectiousAgent"]);
    await this.advance();
  }

  async compareCases() {
    await this.ui.showCases();
    this.state.setFlag("casesCompared");
    this.state.addEvidence(1);
    this.state.adjust({ knowledge: 5 });
    this.state.log("compared_cases", { sharedPattern: true });
    this.ui.toast("Evidência registrada: vínculo temporal e geográfico.");
    await this.advance();
  }

  async callCaio() {
    await this.ui.playDialogue(DIALOGUES.caio);
    this.state.setFlag("caioConsulted");
    this.state.addEvidence(1);
    this.state.log("caio_consulted");
    await this.advance();
  }

  async collectSample() {
    this.state.setSample(true);
    this.state.log("sample_retrieved", { container: "R-01" });
    this.ui.setSample(true);
    this.world.collectSample();
    this.ui.toast("Materiais adicionados ao recipiente de transporte.");
    this.unlock(["biologicalSample"]);
    await this.advance();
  }

  async runActivity(id) {
    this.ui.toast("Carregando módulo da estação…");
    const module = await loadActivity(id);
    const result = await module.run({ state: this.state, ui: this.ui, world: this.world, player: this.player });
    this.ui.updateMetrics(this.state.metrics());
    this.ui.setSample(this.state.hasSample);
    this.world.syncCampaign(this.state);
    if (id === "finale") {
      this.complete(result);
      return;
    }
    await this.advance();
  }

  unlock(keys) {
    keys.forEach((key, index) => {
      if (!this.state.unlock(key)) return;
      window.setTimeout(() => this.ui.unlockKnowledge(key), index * 700);
    });
  }

  complete(result) {
    this.state.playing = false;
    this.player.releasePointer();
    const elapsed = performance.now() - this.state.startedAt;
    this.ui.showCampaignReport(result, elapsed);
  }
}
