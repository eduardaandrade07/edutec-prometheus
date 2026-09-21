import { DEFAULT_CAMPAIGN, DEFAULT_SETTINGS, MISSION_STEPS } from "./data.js?v=3.0.1";

const SETTINGS_KEY = "surto-prometheus-settings-v2";
const CAMPAIGN_KEY = "surto-prometheus-campaign-v2";
const LEGACY_SETTINGS_KEY = "surto-prometheus-settings-v1";

function readStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

class GameState extends EventTarget {
  constructor() {
    super();
    const savedSettings = readStorage(SETTINGS_KEY, null) || readStorage(LEGACY_SETTINGS_KEY, {}) || {};
    this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    this.savedCampaign = readStorage(CAMPAIGN_KEY, null);
    this.hasSave = Boolean(this.savedCampaign && !this.savedCampaign.completed);
    this.hydrate(this.savedCampaign || DEFAULT_CAMPAIGN);
    this.started = false;
    this.playing = false;
    this.paused = false;
    this.modalOpen = false;
    this.startedAt = 0;
  }

  hydrate(data) {
    const campaign = { ...DEFAULT_CAMPAIGN, ...(data || {}) };
    Object.entries(campaign).forEach(([key, value]) => {
      if (!["unlockedKnowledge", "decisions", "actions"].includes(key)) this[key] = value;
    });
    this.unlockedKnowledge = new Set(campaign.unlockedKnowledge || []);
    this.decisions = [...(campaign.decisions || [])];
    this.actions = [...(campaign.actions || [])];
  }

  beginNewCampaign() {
    this.hydrate(DEFAULT_CAMPAIGN);
    this.started = true;
    this.playing = false;
    this.paused = false;
    this.modalOpen = false;
    this.startedAt = performance.now();
    this.hasSave = true;
    this.saveProgress();
    this.emit("reset");
  }

  resumeCampaign() {
    this.hydrate(this.savedCampaign || DEFAULT_CAMPAIGN);
    this.started = true;
    this.playing = true;
    this.paused = false;
    this.modalOpen = false;
    this.startedAt = performance.now();
    this.emit("resume", this.currentStep);
    this.emit("metrics", this.metrics());
  }

  setStep(step) {
    this.currentStep = Math.max(0, Math.min(MISSION_STEPS.length - 1, step));
    this.currentChapter = MISSION_STEPS[this.currentStep]?.chapter || this.currentChapter;
    this.saveProgress();
    this.emit("step", this.currentStep);
  }

  addEvidence(amount = 1) {
    this.evidence = Math.max(0, this.evidence + amount);
    this.saveProgress();
    this.emit("evidence", this.evidence);
  }

  setSample(value) {
    this.hasSample = Boolean(value);
    this.saveProgress();
    this.emit("sample", this.hasSample);
  }

  adjust(patch = {}) {
    if (patch.day) this.day = clamp(this.day + patch.day, 1, 60);
    if (patch.cases) this.cases = clamp(this.cases + patch.cases, 0, 99999);
    if (patch.contagion) this.contagion = clamp(this.contagion + patch.contagion, 0, 100);
    if (patch.resources) this.resources = clamp(this.resources + patch.resources, 0, 150);
    if (patch.knowledge) this.knowledge = clamp(this.knowledge + patch.knowledge, 0, 100);
    if (patch.vaccination) this.vaccination = clamp(this.vaccination + patch.vaccination, 0, 100);
    if (patch.deaths) this.deaths = clamp(this.deaths + patch.deaths, 0, 9999);
    this.saveProgress();
    this.emit("metrics", this.metrics());
  }

  setFlag(key, value = true) {
    this[key] = value;
    this.saveProgress();
    this.emit("flag", { key, value });
  }

  unlock(key) {
    if (this.unlockedKnowledge.has(key)) return false;
    this.unlockedKnowledge.add(key);
    this.saveProgress();
    this.emit("knowledge", key);
    return true;
  }

  unlockMany(keys = []) {
    return keys.filter((key) => this.unlock(key));
  }

  log(action, detail = null) {
    this.actions.push({ action, detail, day: this.day });
    this.saveProgress();
  }

  recordDecision(type, choice, label, effects = {}) {
    const existing = this.decisions.findIndex((decision) => decision.type === type);
    const decision = { type, choice, label, effects, day: this.day };
    if (existing >= 0) this.decisions.splice(existing, 1, decision);
    else this.decisions.push(decision);
    this.saveProgress();
    this.emit("decision", decision);
  }

  metrics() {
    return {
      day: Math.round(this.day),
      cases: Math.round(this.cases),
      contagion: Math.round(this.contagion),
      resources: Math.round(this.resources),
      knowledge: Math.round(this.knowledge),
      vaccination: Math.round(this.vaccination),
      deaths: Math.round(this.deaths),
    };
  }

  snapshot() {
    const campaign = {};
    Object.keys(DEFAULT_CAMPAIGN).forEach((key) => {
      if (key === "unlockedKnowledge") campaign[key] = [...this.unlockedKnowledge];
      else if (key === "decisions") campaign[key] = [...this.decisions];
      else if (key === "actions") campaign[key] = [...this.actions];
      else campaign[key] = this[key];
    });
    return campaign;
  }

  saveProgress() {
    const snapshot = this.snapshot();
    this.savedCampaign = snapshot;
    this.hasSave = !snapshot.completed;
    try {
      localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(snapshot));
    } catch {
      // A campanha continua funcionando durante a sessão.
    }
  }

  finish() {
    this.completed = true;
    this.playing = false;
    this.hasSave = false;
    this.saveProgress();
  }

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // As preferências continuam ativas durante a sessão.
    }
    this.emit("settings", this.settings);
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const gameState = new GameState();
